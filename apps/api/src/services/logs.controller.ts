import { logNames, type LogName, type LogResponse } from "@poco-cloud/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appConfig } from "../config.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const logPaths: Record<LogName, string> = {
  api: join(appConfig.logDir, "api.log"),
  frpc: join(appConfig.logDir, "frpc.log"),
  web: join(appConfig.logDir, "web-test.log"),
  jellyfin: join(appConfig.logDir, "jellyfin.log"),
  filebrowser: join(appConfig.logDir, "filebrowser.log")
};

const tail = (content: string, lines = 200): string[] => {
  const allLines = content.replace(/\r/g, "").split("\n");
  return allLines.slice(Math.max(0, allLines.length - lines)).filter(Boolean);
};

export const logsRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.get(
    "/api/logs/:service",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply): Promise<LogResponse | FastifyReply> => {
      const { service } = request.params as { service?: string };
      if (!logNames.includes(service as LogName)) {
        return reply.code(404).send({ message: "Unknown log" });
      }

      try {
        const content = await readFile(logPaths[service as LogName], "utf8");
        return { service: service as LogName, lines: tail(content) };
      } catch {
        return { service: service as LogName, lines: ["Log file is not available yet."] };
      }
    }
  );
};
