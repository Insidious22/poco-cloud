import {
  systemActionNames,
  type SystemActionName,
  type SystemActionResponse,
  type SystemConfigFile,
  type SystemDiagnostics,
  type SystemStatus
} from "@poco-cloud/shared";
import type { FastifyInstance } from "fastify";
import { access, readFile, stat, writeFile } from "node:fs/promises";
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
      return { ...file, ...result };
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
