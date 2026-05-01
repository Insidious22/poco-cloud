import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import staticPlugin from "@fastify/static";
import Fastify from "fastify";
import { existsSync, createReadStream } from "node:fs";
import { join } from "node:path";
import { appConfig } from "./config.js";
import { authRoutes } from "./auth/auth.routes.js";
import { cleanExpiredSessions } from "./auth/auth.service.js";
import { migrate } from "./db/migrate.js";
import { filesRoutes } from "./services/files.controller.js";
import { logsRoutes } from "./services/logs.controller.js";
import { servicesRoutes } from "./services/services.controller.js";
import { systemRoutes } from "./services/system.controller.js";

const buildServer = async () => {
  const fastify = Fastify({
    logger: {
      level: appConfig.nodeEnv === "production" ? "info" : "debug"
    }
  });

  await fastify.register(helmet);

  const allowedOrigins = [appConfig.webOrigin];
  if (appConfig.nodeEnv !== "production") {
    allowedOrigins.push("http://localhost:5173", "http://127.0.0.1:5173");
  }
  await fastify.register(cors, {
    origin: allowedOrigins,
    credentials: true
  });

  await fastify.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 1024 * 1024 * 200
    }
  });

  await fastify.register(jwt, {
    secret: appConfig.jwtSecret,
    sign: {
      expiresIn: appConfig.jwtExpiresIn
    }
  });

  fastify.get("/health", async () => ({ ok: true, service: "poco-cloud-api" }));
  await fastify.register(authRoutes);
  await fastify.register(systemRoutes);
  await fastify.register(servicesRoutes);
  await fastify.register(logsRoutes);
  await fastify.register(filesRoutes);

  const webDist = join(appConfig.repoRoot, "apps", "web", "dist");
  if (existsSync(webDist)) {
    await fastify.register(staticPlugin, {
      root: webDist,
      prefix: "/"
    });

    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api") || request.url.startsWith("/auth")) {
        return reply.code(404).send({ message: "Not found" });
      }
      return reply.type("text/html").send(createReadStream(join(webDist, "index.html")));
    });
  }

  return fastify;
};

migrate();
cleanExpiredSessions();

const server = await buildServer();
await server.listen({ host: appConfig.host, port: appConfig.port });
