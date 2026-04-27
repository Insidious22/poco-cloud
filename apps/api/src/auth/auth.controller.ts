import { loginSchema, registerSchema } from "@poco-cloud/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { findUserById, loginUser, registerUser } from "./auth.service.js";

export const registerController = async (request: FastifyRequest, reply: FastifyReply) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ message: "Invalid registration payload" });
  }

  try {
    return await registerUser(request.server, parsed.data);
  } catch (error) {
    if ((error as Error).message === "USERNAME_TAKEN") {
      return reply.code(409).send({ message: "Username already exists" });
    }
    throw error;
  }
};

export const loginController = async (request: FastifyRequest, reply: FastifyReply) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ message: "Invalid login payload" });
  }

  try {
    return await loginUser(request.server, parsed.data);
  } catch (error) {
    if ((error as Error).message === "INVALID_CREDENTIALS") {
      return reply.code(401).send({ message: "Invalid username or password" });
    }
    throw error;
  }
};

export const meController = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.currentUser) {
    return reply.code(401).send({ message: "Unauthorized" });
  }

  const user = findUserById(request.currentUser.id);
  if (!user) {
    return reply.code(401).send({ message: "Unauthorized" });
  }

  return { user };
};
