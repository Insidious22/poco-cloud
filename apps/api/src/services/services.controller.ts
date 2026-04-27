import type { ManagedService, ServiceName } from "@poco-cloud/shared";
import { serviceNames } from "@poco-cloud/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { homedir } from "node:os";
import { appConfig } from "../config.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { runControlled, spawnControlled } from "../utils/exec.js";

interface ServiceDefinition {
  name: ServiceName;
  label: string;
  description: string;
  pattern: string;
  logName: ManagedService["logName"];
  start: () => number;
  stop: () => Promise<void>;
}

const serviceDefinitions: Record<ServiceName, ServiceDefinition> = {
  frpc: {
    name: "frpc",
    label: "FRP Client",
    description: "Tunel inverso del Poco F3 hacia el VPS.",
    pattern: "frpc",
    logName: "frpc",
    start: () => spawnControlled("frpc", ["-c", `${homedir()}/frpc.toml`]),
    stop: async () => {
      await runControlled("pkill", ["-f", "frpc"]);
    }
  },
  api: {
    name: "api",
    label: "Poco Cloud API",
    description: "Backend principal del panel de control.",
    pattern: "poco-cloud.*apps/api",
    logName: "api",
    start: () => spawnControlled("sh", [`${appConfig.serviceScriptDir}/start-api.sh`]),
    stop: async () => {
      await runControlled("pkill", ["-f", "poco-cloud.*apps/api"]);
    }
  },
  jellyfin: {
    name: "jellyfin",
    label: "Jellyfin",
    description: "Servidor multimedia personal.",
    pattern: "jellyfin",
    logName: "jellyfin",
    start: () => spawnControlled("jellyfin"),
    stop: async () => {
      await runControlled("pkill", ["-f", "jellyfin"]);
    }
  },
  filebrowser: {
    name: "filebrowser",
    label: "File Browser",
    description: "Explorador web de archivos.",
    pattern: "filebrowser",
    logName: "filebrowser",
    start: () => spawnControlled("filebrowser", ["-r", appConfig.filesRoot]),
    stop: async () => {
      await runControlled("pkill", ["-f", "filebrowser"]);
    }
  }
};

const getServiceStatus = async (service: ServiceDefinition): Promise<ManagedService> => {
  const result = await runControlled("pgrep", ["-f", service.pattern], 2000);
  const pid = Number(result.stdout.trim().split("\n")[0]);

  return {
    name: service.name,
    label: service.label,
    description: service.description,
    status: Number.isFinite(pid) && pid > 0 ? "running" : "stopped",
    ...(Number.isFinite(pid) && pid > 0 ? { pid } : {}),
    logName: service.logName
  };
};

const parseServiceName = (request: FastifyRequest): ServiceName | null => {
  const { name } = request.params as { name?: string };
  return serviceNames.includes(name as ServiceName) ? (name as ServiceName) : null;
};

export const servicesRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.get("/api/services", { preHandler: requireAuth }, async () => {
    return Promise.all(Object.values(serviceDefinitions).map(getServiceStatus));
  });

  fastify.post(
    "/api/services/:name/start",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const name = parseServiceName(request);
      if (!name) return reply.code(404).send({ message: "Unknown service" });

      const service = serviceDefinitions[name];
      const pid = service.start();
      return { message: "Service start requested", service: name, pid };
    }
  );

  fastify.post(
    "/api/services/:name/stop",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const name = parseServiceName(request);
      if (!name) return reply.code(404).send({ message: "Unknown service" });

      await serviceDefinitions[name].stop();
      return { message: "Service stop requested", service: name };
    }
  );
};
