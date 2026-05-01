import type { AuthResponse, AuthUser, AuthSession } from "@poco-cloud/shared";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { appConfig } from "../config.js";
import { db } from "../db/connection.js";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
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

const sqliteDate = (date: Date): string => date.toISOString().replace("T", " ").slice(0, 19);

const sessionExpiryDate = (): Date => new Date(Date.now() + appConfig.jwtExpiresInMs);

export const registerUser = async (
  fastify: FastifyInstance,
  input: { username: string; password: string; displayName?: string | undefined }
): Promise<AuthResponse> => {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const displayName = input.displayName ?? input.username;

  try {
    db.exec("BEGIN IMMEDIATE");

    if (countUsers() > 0 && !appConfig.allowRegistration) {
      throw new Error("REGISTRATION_DISABLED");
    }

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(input.username);
    if (existing) {
      throw new Error("USERNAME_TAKEN");
    }

    db.prepare(
      "INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)"
    ).run(id, input.username, displayName, passwordHash);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

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

export const verifyUserPassword = async (userId: string, password: string): Promise<boolean> => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
  if (!row) return false;
  return bcrypt.compare(password, row.password_hash);
};

const createSession = async (
  fastify: FastifyInstance,
  user: AuthUser
): Promise<AuthResponse> => {
  const sessionId = randomUUID();
  const tokenId = randomUUID();
  const expiresAt = sqliteDate(sessionExpiryDate());
  const token = await fastify.jwt.sign({
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    jti: tokenId
  });

  db.prepare("INSERT INTO sessions (id, user_id, token_id, expires_at) VALUES (?, ?, ?, ?)").run(
    sessionId,
    user.id,
    tokenId,
    expiresAt
  );

  return { token, user };
};

export const assertSessionActive = (tokenId: string): boolean => {
  const row = db
    .prepare(
      "SELECT id FROM sessions WHERE token_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))"
    )
    .get(tokenId);
  return Boolean(row);
};

export const revokeSession = (tokenId: string): void => {
  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE token_id = ?").run(tokenId);
};

export const revokeAllUserSessions = (userId: string): void => {
  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").run(userId);
};

export const listUserSessions = (userId: string): AuthSession[] => {
  const rows = db
    .prepare(
      "SELECT id, user_id, token_id, created_at, expires_at, revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(userId) as unknown as SessionRow[];

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    active: !row.revoked_at && (!row.expires_at || row.expires_at > sqliteDate(new Date()))
  }));
};

export const cleanExpiredSessions = (): void => {
  db.prepare("DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < datetime('now', '-30 days')").run();
};
