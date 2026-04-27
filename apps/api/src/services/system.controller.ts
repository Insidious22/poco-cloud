import type { SystemStatus } from "@poco-cloud/shared";
import type { FastifyInstance } from "fastify";
import { cpus, hostname, loadavg, networkInterfaces, platform, totalmem, freemem, uptime } from "node:os";
import { appConfig } from "../config.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { runControlled } from "../utils/exec.js";

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
};
