import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  loginController,
  logoutAllController,
  logoutController,
  meController,
  registerController,
  sessionsController
} from "./auth.controller.js";

export const authRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post("/auth/register", { config: { rateLimit: { max: 3, timeWindow: "5 minutes" } } }, registerController);
  fastify.post("/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, loginController);
  fastify.get("/auth/me", { preHandler: requireAuth }, meController);
  fastify.get("/auth/sessions", { preHandler: requireAuth }, sessionsController);
  fastify.post("/auth/logout", { preHandler: requireAuth }, logoutController);
  fastify.post("/auth/logout-all", { preHandler: requireAuth }, logoutAllController);
};
