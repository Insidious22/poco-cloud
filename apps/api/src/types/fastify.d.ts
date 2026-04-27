import type { AuthUser } from "@poco-cloud/shared";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      username: string;
      displayName: string;
      jti: string;
    };
    user: {
      sub: string;
      username: string;
      displayName: string;
      jti: string;
      iat: number;
      exp: number;
    };
  }
}
