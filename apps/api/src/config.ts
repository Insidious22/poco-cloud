import { config as loadEnv } from "dotenv";
import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv();

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(apiRoot, "..", "..");

const expandHome = (value: string): string => {
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return resolve(homedir(), value.slice(2));
  return value;
};

const resolveFromApi = (value: string): string => {
  const expanded = expandHome(value);
  return isAbsolute(expanded) ? expanded : resolve(apiRoot, expanded);
};

const parseDurationMs = (value: string): number => {
  const match = value.trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return amount * (multipliers[unit] ?? 1000);
};

const nodeEnv = process.env.NODE_ENV ?? "development";
const rawJwtSecret = process.env.JWT_SECRET;
const weakSecret =
  !rawJwtSecret ||
  rawJwtSecret.length < 32 ||
  /change|dev-only|secret|password/i.test(rawJwtSecret);

if (nodeEnv === "production" && weakSecret) {
  throw new Error("JWT_SECRET is missing or weak. Set a random 32+ character secret before starting Poco Cloud.");
}

if (nodeEnv !== "production" && weakSecret) {
  console.warn("[poco-cloud] Using a development JWT secret. Do not expose this server publicly.");
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "7d";

export const appConfig = {
  nodeEnv,
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  jwtSecret: rawJwtSecret ?? "local-development-only-secret-please-change",
  jwtExpiresIn,
  jwtExpiresInMs: parseDurationMs(jwtExpiresIn),
  authCookieName: process.env.AUTH_COOKIE_NAME ?? "poco_cloud_session",
  dbPath: resolveFromApi(process.env.DB_PATH ?? "../../data/poco-cloud.sqlite"),
  filesRoot: resolveFromApi(process.env.FILES_ROOT ?? "~/poco-cloud/storage"),
  logDir: resolveFromApi(process.env.LOG_DIR ?? "~"),
  serviceScriptDir: resolveFromApi(process.env.SERVICE_SCRIPT_DIR ?? "~/poco-cloud/services"),
  sshPublicHost: process.env.SSH_PUBLIC_HOST,
  sshPublicPort: Number(process.env.SSH_PUBLIC_PORT ?? 2222),
  allowRegistration: process.env.ALLOW_REGISTRATION === "true",
  allowFileDelete: process.env.ALLOW_FILE_DELETE === "true",
  exposeConfigContent: process.env.EXPOSE_CONFIG_CONTENT === "true",
  repoRoot,
  isTermux: process.env.PREFIX?.includes("com.termux") ?? false
};
