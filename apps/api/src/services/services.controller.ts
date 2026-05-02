import { confirmPasswordSchema, type ManagedService, type ServiceName } from "@poco-cloud/shared";
import { serviceNames } from "@poco-cloud/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { homedir } from "node:os";
import { appConfig } from "../config.js";
import { verifyUserPassword } from "../auth/auth.service.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { runControlled, spawnControlled, spawnScript } from "../utils/exec.js";

interface ServiceDefinition {
  name: ServiceName;
  label: string;
  description: string;
  pattern: string;
  logName: ManagedService["logName"];
  controllable: boolean;
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
    controllable: false,
    start: () => spawnControlled("frpc", ["-c", `${homedir()}/frpc.toml`]),
    stop: async () => {
      await runControlled("pkill", ["-f", "frpc.*-c.*/frpc.toml"]);
    }
  },
  api: {
    name: "api",
    label: "Poco Cloud API",
    description: "Backend principal del panel de control.",
    pattern: "poco-cloud.*apps/api",
    logName: "api",
    controllable: false,
    start: () => spawnScript("start-api"),
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
    controllable: true,
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
    controllable: true,
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
    logName: service.logName,
    controllable: service.controllable
  };
};

const parseServiceName = (request: FastifyRequest): ServiceName | null => {
  const { name } = request.params as { name?: string };
  return serviceNames.includes(name as ServiceName) ? (name as ServiceName) : null;
};

const confirmPassword = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
  const parsed = confirmPasswordSchema.safeParse(request.body);
  if (!parsed.success || !request.currentUser) {
    reply.code(400).send({ message: "Password confirmation is required" });
    return false;
  }

  const valid = await verifyUserPassword(request.currentUser.id, parsed.data.password);
  if (!valid) {
    reply.code(403).send({ message: "Password confirmation failed" });
    return false;
  }

  return true;
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
      if (!(await confirmPassword(request, reply))) return reply;

      const service = serviceDefinitions[name];
      if (!service.controllable) {
        return reply.code(403).send({ message: "Protected service cannot be controlled from the web" });
      }
      try {
        const pid = service.start();
        return { message: "Service start requested", service: name, pid };
      } catch (error) {
        request.log.warn({ error, service: name }, "Service start failed");
        return reply.code(409).send({ message: (error as Error).message });
      }
    }
  );

  fastify.post(
    "/api/services/:name/stop",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const name = parseServiceName(request);
      if (!name) return reply.code(404).send({ message: "Unknown service" });
      if (!(await confirmPassword(request, reply))) return reply;

      const service = serviceDefinitions[name];
      if (!service.controllable) {
        return reply.code(403).send({ message: "Protected service cannot be controlled from the web" });
      }

      try {
        await service.stop();
        return { message: "Service stop requested", service: name };
      } catch (error) {
        request.log.warn({ error, service: name }, "Service stop failed");
        return reply.code(409).send({ message: (error as Error).message });
      }
    }
  );
};
