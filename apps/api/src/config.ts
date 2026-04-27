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

export const appConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  dbPath: resolveFromApi(process.env.DB_PATH ?? "../../data/poco-cloud.sqlite"),
  filesRoot: resolveFromApi(process.env.FILES_ROOT ?? "~"),
  logDir: resolveFromApi(process.env.LOG_DIR ?? "~"),
  serviceScriptDir: resolveFromApi(process.env.SERVICE_SCRIPT_DIR ?? "~/poco-cloud/services"),
  repoRoot,
  isTermux: process.env.PREFIX?.includes("com.termux") ?? false
};
