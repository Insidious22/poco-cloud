import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware.js";
import { loginController, meController, registerController } from "./auth.controller.js";

export const authRoutes = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post("/auth/register", registerController);
  fastify.post("/auth/login", loginController);
  fastify.get("/auth/me", { preHandler: requireAuth }, meController);
};
