import { loginSchema, registerSchema } from "@poco-cloud/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { appConfig } from "../config.js";
import { clearAuthCookie, setAuthCookie } from "./auth.cookies.js";
import {
  countUsers,
  findUserById,
  listUserSessions,
  loginUser,
  registerUser,
  revokeAllUserSessions,
  revokeSession
} from "./auth.service.js";

export const registerController = async (request: FastifyRequest, reply: FastifyReply) => {
  if (countUsers() > 0 && !appConfig.allowRegistration) {
    return reply.code(403).send({ message: "Registration is disabled" });
  }

  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ message: "Invalid registration payload" });
  }

  try {
    const response = await registerUser(request.server, parsed.data);
    if (response.token) setAuthCookie(reply, response.token);
    return { user: response.user };
  } catch (error) {
    if ((error as Error).message === "USERNAME_TAKEN") {
      return reply.code(409).send({ message: "Username already exists" });
    }
    if ((error as Error).message === "REGISTRATION_DISABLED") {
      return reply.code(403).send({ message: "Registration is disabled" });
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
    const response = await loginUser(request.server, parsed.data);
    if (response.token) setAuthCookie(reply, response.token);
    return { user: response.user };
  } catch (error) {
    if ((error as Error).message === "INVALID_CREDENTIALS") {
      request.log.warn({ username: parsed.data.username, ip: request.ip }, "Invalid login attempt");
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

export const logoutController = async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.authTokenId) {
    revokeSession(request.authTokenId);
  }
  clearAuthCookie(reply);
  return { message: "Logged out" };
};

export const logoutAllController = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.currentUser) {
    return reply.code(401).send({ message: "Unauthorized" });
  }
  revokeAllUserSessions(request.currentUser.id);
  clearAuthCookie(reply);
  return { message: "All sessions revoked" };
};

export const sessionsController = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.currentUser) {
    return reply.code(401).send({ message: "Unauthorized" });
  }
  return { sessions: listUserSessions(request.currentUser.id) };
};
