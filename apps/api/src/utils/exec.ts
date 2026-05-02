import { execFile, spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { delimiter } from "node:path";
import { isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { appConfig } from "../config.js";

const execFileAsync = promisify(execFile);

const allowedCommands = new Set([
  "df",
  "free",
  "hostname",
  "ip",
  "node",
  "pgrep",
  "pkill",
  "ps",
  "sshd",
  "termux-battery-status",
  "termux-wake-lock",
  "termux-wake-unlock",
  "uptime",
  "frpc",
  "jellyfin",
  "filebrowser"
]);

const allowedScripts: Record<string, () => string> = {
  "start-api": () => resolve(appConfig.serviceScriptDir, "start-api.sh")
};

export interface CommandResult {
  stdout: string;
  stderr: string;
}

const commandExists = (command: string): boolean => {
  if (isAbsolute(command)) return existsSync(command);

  return (process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .some((directory) => existsSync(join(directory, command)));
};

export const runControlled = async (
  command: string,
  args: string[] = [],
  timeoutMs = 5000
): Promise<CommandResult> => {
  if (!allowedCommands.has(command)) {
    throw new Error(`Command is not allowed: ${command}`);
  }

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });

    return { stdout, stderr };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message
    };
  }
};

export const spawnControlled = (
  command: string,
  args: string[] = [],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): number => {
  if (!allowedCommands.has(command)) {
    throw new Error(`Command is not allowed: ${command}`);
  }

  if (!commandExists(command)) {
    throw new Error(`Command is not installed: ${command}`);
  }

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    detached: true,
    stdio: "ignore"
  });

  child.once("error", () => undefined);
  child.unref();
  return child.pid ?? 0;
};

export const spawnScript = (scriptKey: keyof typeof allowedScripts): number => {
  const resolver = allowedScripts[scriptKey];
  if (!resolver) {
    throw new Error(`Script is not allowed: ${scriptKey}`);
  }

  const script = resolver();
  if (!existsSync(script)) {
    throw new Error(`Allowed script does not exist: ${scriptKey}`);
  }

  const allowedRoots = [appConfig.serviceScriptDir, resolve(appConfig.repoRoot, "infra", "termux")].map((root) =>
    realpathSync(root)
  );
  const realScript = realpathSync(script);
  const insideAllowedRoot = allowedRoots.some((root) => {
    const rel = relative(root, realScript);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });

  if (!insideAllowedRoot) {
    throw new Error(`Script resolved outside allowed roots: ${scriptKey}`);
  }

  const child = spawn(realScript, [], {
    detached: true,
    stdio: "ignore"
  });

  child.once("error", () => undefined);
  child.unref();
  return child.pid ?? 0;
};
