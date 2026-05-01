import type { FastifyReply, FastifyRequest } from "fastify";
import { readAuthToken } from "../auth/auth.cookies.js";
import { assertSessionActive } from "../auth/auth.service.js";

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const rawToken = readAuthToken(request);
    if (!rawToken) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const token = request.server.jwt.verify<{
      sub: string;
      username: string;
      displayName: string;
      jti: string;
    }>(rawToken);

    if (!assertSessionActive(token.jti)) {
      return reply.code(401).send({ message: "Session expired" });
    }

    request.authTokenId = token.jti;
    request.currentUser = {
      id: token.sub,
      username: token.username,
      displayName: token.displayName
    };
  } catch {
    return reply.code(401).send({ message: "Unauthorized" });
  }
};
