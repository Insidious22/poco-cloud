import type { FastifyReply, FastifyRequest } from "fastify";
import { appConfig } from "../config.js";

const encodeCookieValue = (value: string): string => encodeURIComponent(value);

export const readAuthToken = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const cookie = cookies.find((part) => part.startsWith(`${appConfig.authCookieName}=`));
  if (!cookie) return null;

  return decodeURIComponent(cookie.slice(appConfig.authCookieName.length + 1));
};

export const setAuthCookie = (reply: FastifyReply, token: string): void => {
  const attributes = [
    `${appConfig.authCookieName}=${encodeCookieValue(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(appConfig.jwtExpiresInMs / 1000)}`
  ];

  if (appConfig.nodeEnv === "production") {
    attributes.push("Secure");
  }

  reply.header("Set-Cookie", attributes.join("; "));
};

export const clearAuthCookie = (reply: FastifyReply): void => {
  const attributes = [
    `${appConfig.authCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];

  if (appConfig.nodeEnv === "production") {
    attributes.push("Secure");
  }

  reply.header("Set-Cookie", attributes.join("; "));
};
