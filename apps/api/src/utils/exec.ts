import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

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
  "python",
  "python3",
  "sh",
  "termux-battery-status",
  "termux-wake-lock",
  "uptime",
  "frpc",
  "jellyfin",
  "filebrowser"
]);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

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

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    detached: true,
    stdio: "ignore"
  });

  child.unref();
  return child.pid ?? 0;
};
