import type { AuthResponse, AuthUser } from "@poco-cloud/shared";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
}

const toAuthUser = (row: UserRow): AuthUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name
});

export const findUserById = (id: string): AuthUser | null => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toAuthUser(row) : null;
};

export const countUsers = (): number => {
  const row = db.prepare("SELECT COUNT(*) AS total FROM users").get() as { total: number };
  return row.total;
};

export const registerUser = async (
  fastify: FastifyInstance,
  input: { username: string; password: string; displayName?: string | undefined }
): Promise<AuthResponse> => {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(input.username);
  if (existing) {
    throw new Error("USERNAME_TAKEN");
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const displayName = input.displayName ?? input.username;

  db.prepare(
    "INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)"
  ).run(id, input.username, displayName, passwordHash);

  return createSession(fastify, { id, username: input.username, displayName });
};

export const loginUser = async (
  fastify: FastifyInstance,
  input: { username: string; password: string }
): Promise<AuthResponse> => {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(input.username) as
    | UserRow
    | undefined;

  if (!row) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordOk = await bcrypt.compare(input.password, row.password_hash);
  if (!passwordOk) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return createSession(fastify, toAuthUser(row));
};

const createSession = async (
  fastify: FastifyInstance,
  user: AuthUser
): Promise<AuthResponse> => {
  const sessionId = randomUUID();
  const tokenId = randomUUID();
  const token = await fastify.jwt.sign({
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    jti: tokenId
  });

  db.prepare("INSERT INTO sessions (id, user_id, token_id) VALUES (?, ?, ?)").run(
    sessionId,
    user.id,
    tokenId
  );

  return { token, user };
};

export const assertSessionActive = (tokenId: string): boolean => {
  const row = db
    .prepare("SELECT id FROM sessions WHERE token_id = ? AND revoked_at IS NULL")
    .get(tokenId);
  return Boolean(row);
};
