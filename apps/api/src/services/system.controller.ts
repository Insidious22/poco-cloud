import {
  sshPublicKeySchema,
  systemActionNames,
  type AuthorizedSshKey,
  type SshAccessOverview,
  type SystemActionName,
  type SystemActionResponse,
  type SystemConfigFile,
  type SystemDiagnostics,
  type SystemStatus
} from "@poco-cloud/shared";
import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { access, chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { cpus, hostname, loadavg, networkInterfaces, platform, totalmem, freemem, uptime, homedir } from "node:os";
import { join } from "node:path";
import { appConfig } from "../config.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { runControlled, spawnControlled } from "../utils/exec.js";

const parseDf = (stdout: string): SystemStatus["disk"] => {
  const line = stdout.trim().split("\n").at(-1);
  if (!line) {
    return { path: appConfig.filesRoot, totalGb: 0, usedGb: 0, availableGb: 0, usedPercent: 0 };
  }

  const parts = line.replace(/\s+/g, " ").split(" ");
  const totalKb = Number(parts[1] ?? 0);
  const usedKb = Number(parts[2] ?? 0);
  const availableKb = Number(parts[3] ?? 0);
  const usedPercent = Number((parts[4] ?? "0").replace("%", ""));

  return {
    path: appConfig.filesRoot,
    totalGb: Math.round((totalKb / 1024 / 1024) * 10) / 10,
    usedGb: Math.round((usedKb / 1024 / 1024) * 10) / 10,
    availableGb: Math.round((availableKb / 1024 / 1024) * 10) / 10,
    usedPercent: Number.isFinite(usedPercent) ? usedPercent : 0
  };
};

const readBattery = async (): Promise<SystemStatus["battery"]> => {
  const result = await runControlled("termux-battery-status", [], 2000);
  if (!result.stdout.trim()) {
    return { available: false, percentage: null, status: null, temperatureC: null };
  }

  try {
    const json = JSON.parse(result.stdout) as {
      percentage?: number;
      status?: string;
      temperature?: number;
    };

    return {
      available: true,
      percentage: json.percentage ?? null,
      status: json.status ?? null,
      temperatureC: json.temperature ?? null
    };
  } catch {
    return { available: false, percentage: null, status: null, temperatureC: null };
  }
};

const redacted = (value: string): string =>
  value
    .replace(/(auth\.token\s*=\s*)("[^"]+"|'[^']+'|[^\s#]+)/gi, '$1"***redacted***"')
    .replace(/((?:JWT_SECRET|FRP_TOKEN|TOKEN|SECRET|PASSWORD|PASS)=).*/gi, "$1***redacted***");

const readSafeText = async (path: string): Promise<{ exists: boolean; content: string }> => {
  try {
    const content = await readFile(path, "utf8");
    return { exists: true, content: redacted(content).slice(0, 16_000) };
  } catch {
    return { exists: false, content: "" };
  }
};

const fileDiagnostic = async (key: string, label: string, path: string): Promise<SystemDiagnostics["files"][number]> => {
  try {
    const info = await stat(path);
    return {
      key,
      label,
      status: "ok",
      value: "Instalado",
      detail: `${path} (${Math.max(1, Math.round(info.size / 1024))} KB)`
    };
  } catch {
    return {
      key,
      label,
      status: "error",
      value: "No encontrado",
      detail: path
    };
  }
};

const processStatus = async (
  name: "api" | "frpc" | "sshd",
  pattern: string
): Promise<SystemDiagnostics["processes"][number]> => {
  const result = await runControlled("pgrep", ["-af", pattern], 2500);
  const line = result.stdout
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .find((item) => !item.includes("pgrep"));

  const pid = Number(line?.split(/\s+/)[0] ?? 0);

  return {
    name,
    running: Boolean(line),
    pid: Number.isFinite(pid) && pid > 0 ? pid : null,
    detail: line ?? result.stderr.trim() ?? "Sin proceso activo"
  };
};

const configFiles = async (): Promise<SystemConfigFile[]> => {
  const files: Array<Omit<SystemConfigFile, "exists" | "content">> = [
    { key: "frpc", label: "frpc.toml", path: join(homedir(), "frpc.toml") },
    { key: "env", label: "poco-cloud.env", path: join(homedir(), "poco-cloud.env") },
    { key: "boot", label: "Termux:Boot", path: join(homedir(), ".termux", "boot", "start-poco-cloud.sh") }
  ];

  return Promise.all(
    files.map(async (file) => {
      const result = await readSafeText(file.path);
      return {
        ...file,
        exists: result.exists,
        content: appConfig.exposeConfigContent
          ? result.content
          : result.exists
            ? "Contenido oculto por seguridad. Activa EXPOSE_CONFIG_CONTENT=true solo durante mantenimiento."
            : ""
      };
    })
  );
};

const readTail = async (path: string, lineCount = 120): Promise<string[]> => {
  const result = await readSafeText(path);
  if (!result.exists) return [];
  return result.content.split("\n").slice(-lineCount);
};

const ensureFileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const sshDir = () => join(homedir(), ".ssh");
const authorizedKeysPath = () => join(sshDir(), "authorized_keys");
const supportedKeyTypes = new Set(["ssh-ed25519", "ssh-rsa", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521", "sk-ssh-ed25519@openssh.com"]);

const normalizeAuthorizedKey = (value: string, label: string): string => {
  const firstLine = value
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    throw new Error("La llave publica esta vacia");
  }

  const parts = firstLine.replace(/\s+/g, " ").split(" ");
  const keyIndex = parts.findIndex((part) => supportedKeyTypes.has(part));
  if (keyIndex < 0 || !parts[keyIndex + 1]) {
    throw new Error("Formato de llave SSH no soportado");
  }

  const type = parts[keyIndex] as string;
  const body = parts[keyIndex + 1] as string;
  if (!/^[A-Za-z0-9+/]+={0,3}$/.test(body)) {
    throw new Error("La llave publica no parece estar en base64 valido");
  }

  const comment = parts.slice(keyIndex + 2).join(" ") || label;
  return `${type} ${body} ${comment}`.trim();
};

const keyFingerprint = (line: string): string => {
  const parts = line.replace(/\s+/g, " ").split(" ");
  const keyIndex = parts.findIndex((part) => supportedKeyTypes.has(part));
  const body = parts[keyIndex + 1] ?? "";
  try {
    return `SHA256:${createHash("sha256").update(Buffer.from(body, "base64")).digest("base64").replace(/=+$/, "")}`;
  } catch {
    return "SHA256:unknown";
  }
};

const keyId = (line: string): string => createHash("sha256").update(line).digest("hex").slice(0, 16);

const parseAuthorizedKey = (line: string): AuthorizedSshKey | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const parts = trimmed.replace(/\s+/g, " ").split(" ");
  const keyIndex = parts.findIndex((part) => supportedKeyTypes.has(part));
  if (keyIndex < 0) return null;
  const comment = parts.slice(keyIndex + 2).join(" ");
  return {
    id: keyId(trimmed),
    label: comment || "Sin etiqueta",
    type: parts[keyIndex] as string,
    fingerprint: keyFingerprint(trimmed),
    comment,
    createdFromLine: trimmed
  };
};

const readAuthorizedKeys = async (): Promise<{ lines: string[]; keys: AuthorizedSshKey[] }> => {
  try {
    const content = await readFile(authorizedKeysPath(), "utf8");
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    return { lines, keys: lines.map(parseAuthorizedKey).filter((key): key is AuthorizedSshKey => Boolean(key)) };
  } catch {
    return { lines: [], keys: [] };
  }
};

const ensureSshFiles = async (): Promise<void> => {
  await mkdir(sshDir(), { recursive: true });
  await chmod(sshDir(), 0o700).catch(() => undefined);
  if (!(await ensureFileExists(authorizedKeysPath()))) {
    await writeFile(authorizedKeysPath(), "", "utf8");
  }
  await chmod(authorizedKeysPath(), 0o600).catch(() => undefined);
};

const sshHostFromRequest = (requestHost?: string): string => {
  const configured = appConfig.sshPublicHost?.trim();
  if (configured) return configured;
  return (requestHost ?? "YOUR_VPS_IP").split(":")[0] ?? "YOUR_VPS_IP";
};

export const systemRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.get("/api/system/status", { preHandler: requireAuth }, async (): Promise<SystemStatus> => {
    const freeMb = Math.round(freemem() / 1024 / 1024);
    const totalMb = Math.round(totalmem() / 1024 / 1024);
    const diskResult = await runControlled("df", ["-k", appConfig.filesRoot], 2500);
    const battery = await readBattery();
    const interfaces = Object.entries(networkInterfaces()).flatMap(([name, records]) =>
      (records ?? [])
        .filter((record) => !record.internal)
        .map((record) => ({ name, address: record.address, family: record.family }))
    );

    return {
      hostname: hostname(),
      platform: platform(),
      uptimeSeconds: Math.round(uptime()),
      loadAverage: loadavg().map((value) => Math.round(value * 100) / 100),
      memory: {
        totalMb,
        freeMb,
        usedMb: totalMb - freeMb
      },
      disk: parseDf(diskResult.stdout),
      battery,
      network: { interfaces },
      termux: {
        detected: appConfig.isTermux,
        wakeLockHint: "Use termux-wake-lock and disable battery optimization for Termux."
      }
    };
  });

  fastify.get("/api/system/cpu", { preHandler: requireAuth }, async () => ({
    cores: cpus().length,
    model: cpus()[0]?.model ?? "unknown"
  }));

  fastify.get("/api/system/diagnostics", { preHandler: requireAuth }, async (): Promise<SystemDiagnostics> => {
    const [api, frpc, sshd, frpcFile, envFile, bootFile, restartFile] = await Promise.all([
      processStatus("api", "node dist/index.js"),
      processStatus("frpc", "frpc"),
      processStatus("sshd", "sshd"),
      fileDiagnostic("frpc", "Configuracion frp", join(homedir(), "frpc.toml")),
      fileDiagnostic("env", "Variables de entorno", join(homedir(), "poco-cloud.env")),
      fileDiagnostic("boot", "Arranque Termux", join(homedir(), ".termux", "boot", "start-poco-cloud.sh")),
      fileDiagnostic("restart-frpc", "Script restart frp", join(appConfig.repoRoot, "infra", "termux", "restart-frpc.sh"))
    ]);

    return {
      checkedAt: new Date().toISOString(),
      termux: {
        detected: appConfig.isTermux,
        prefix: process.env.PREFIX ?? null,
        home: homedir()
      },
      processes: [api, frpc, sshd],
      files: [frpcFile, envFile, bootFile, restartFile]
    };
  });

  fastify.get("/api/system/config", { preHandler: requireAuth }, async (): Promise<SystemConfigFile[]> => configFiles());

  fastify.get("/api/system/logs/boot", { preHandler: requireAuth }, async () => ({
    service: "boot",
    lines: await readTail(join(homedir(), "boot-poco-cloud.log"))
  }));

  fastify.get("/api/system/ssh/access", { preHandler: requireAuth }, async (request): Promise<SshAccessOverview> => {
    await ensureSshFiles();
    const { keys } = await readAuthorizedKeys();
    const host = sshHostFromRequest(request.headers.host);
    const user = process.env.USER ?? homedir().split("/").at(-1) ?? "u0_a369";

    return {
      user,
      host,
      port: appConfig.sshPublicPort,
      command: `ssh -p ${appConfig.sshPublicPort} ${user}@${host}`,
      authorizedKeysPath: authorizedKeysPath(),
      keys
    };
  });

  fastify.post<{ Body: { label: string; publicKey: string } }>(
    "/api/system/ssh/keys",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = sshPublicKeySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? "Llave publica invalida" });
      }

      await ensureSshFiles();
      let normalized: string;
      try {
        normalized = normalizeAuthorizedKey(parsed.data.publicKey, parsed.data.label);
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }

      const { lines } = await readAuthorizedKeys();
      const incomingFingerprint = keyFingerprint(normalized);
      const alreadyExists = lines.some((line) => keyFingerprint(line) === incomingFingerprint);
      if (alreadyExists) {
        return reply.code(409).send({ message: "Esa llave SSH ya esta autorizada" });
      }

      const lineWithLabel = `${normalized} poco-cloud:${parsed.data.label.replace(/\s+/g, "-")}`;
      await writeFile(authorizedKeysPath(), `${[...lines, lineWithLabel].join("\n")}\n`, "utf8");
      await chmod(authorizedKeysPath(), 0o600).catch(() => undefined);
      return { ok: true, key: parseAuthorizedKey(lineWithLabel) };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/api/system/ssh/keys/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      await ensureSshFiles();
      const { lines } = await readAuthorizedKeys();
      const nextLines = lines.filter((line) => keyId(line) !== request.params.id);
      if (nextLines.length === lines.length) {
        return reply.code(404).send({ message: "Llave SSH no encontrada" });
      }
      await writeFile(authorizedKeysPath(), `${nextLines.join("\n")}${nextLines.length ? "\n" : ""}`, "utf8");
      await chmod(authorizedKeysPath(), 0o600).catch(() => undefined);
      return { ok: true };
    }
  );

  fastify.post<{ Params: { action: SystemActionName } }>(
    "/api/system/actions/:action",
    { preHandler: requireAuth },
    async (request, reply): Promise<SystemActionResponse> => {
      const action = request.params.action;
      if (!(systemActionNames as readonly string[]).includes(action)) {
        reply.code(404);
        return { ok: false, action, message: "Accion no permitida" };
      }

      if (action === "wake-lock") {
        const result = await runControlled("termux-wake-lock", [], 3000);
        return { ok: !result.stderr, action, message: result.stderr || "Wake lock activado" };
      }

      if (action === "wake-unlock") {
        const result = await runControlled("termux-wake-unlock", [], 3000);
        return { ok: !result.stderr, action, message: result.stderr || "Wake lock liberado" };
      }

      if (action === "start-sshd") {
        const result = await runControlled("sshd", [], 3000);
        return { ok: !result.stderr, action, message: result.stderr || "SSH iniciado" };
      }

      if (action === "restart-frpc") {
        const script = join(appConfig.repoRoot, "infra", "termux", "restart-frpc.sh");
        if (!(await ensureFileExists(script))) {
          reply.code(500);
          return { ok: false, action, message: "No existe el script restart-frpc.sh" };
        }
        const pid = spawnControlled("sh", [script]);
        return { ok: true, action, message: `Reinicio de frp solicitado. PID ${pid}` };
      }

      if (action === "clear-api-log") {
        await writeFile(join(homedir(), "api.log"), "", "utf8");
        return { ok: true, action, message: "Log de API limpiado" };
      }

      await writeFile(join(homedir(), "frpc.log"), "", "utf8");
      return { ok: true, action, message: "Log de frp limpiado" };
    }
  );
};
