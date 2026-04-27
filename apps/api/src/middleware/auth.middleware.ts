import type { FastifyReply, FastifyRequest } from "fastify";
import { assertSessionActive } from "../auth/auth.service.js";

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const token = await request.jwtVerify<{
      sub: string;
      username: string;
      displayName: string;
      jti: string;
    }>();
    if (!assertSessionActive(token.jti)) {
      return reply.code(401).send({ message: "Session expired" });
    }

    request.currentUser = {
      id: token.sub,
      username: token.username,
      displayName: token.displayName
    };
  } catch {
    return reply.code(401).send({ message: "Unauthorized" });
  }
};
