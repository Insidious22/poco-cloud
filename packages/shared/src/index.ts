import { z } from "zod";

export const serviceNames = ["api", "frpc", "jellyfin", "filebrowser"] as const;
export type ServiceName = (typeof serviceNames)[number];

export const logNames = ["api", "frpc", "web", "jellyfin", "filebrowser"] as const;
export type LogName = (typeof logNames)[number];

export const systemActionNames = [
  "wake-lock",
  "wake-unlock",
  "start-sshd",
  "restart-frpc",
  "clear-api-log",
  "clear-frpc-log"
] as const;
export type SystemActionName = (typeof systemActionNames)[number];

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(256)
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(80).optional()
});

export const filePathSchema = z.object({
  path: z.string().trim().min(1).max(2048)
});

export const mkdirSchema = z.object({
  path: z.string().trim().min(1).max(2048),
  name: z.string().trim().min(1).max(120)
});

export const deleteFileSchema = z.object({
  path: z.string().trim().min(1).max(2048)
});

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface SystemStatus {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  loadAverage: number[];
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
  };
  disk: {
    path: string;
    totalGb: number;
    usedGb: number;
    availableGb: number;
    usedPercent: number;
  };
  battery: {
    available: boolean;
    percentage: number | null;
    status: string | null;
    temperatureC: number | null;
  };
  network: {
    interfaces: Array<{ name: string; address: string; family: string }>;
  };
  termux: {
    detected: boolean;
    wakeLockHint: string;
  };
}

export interface SystemDiagnosticItem {
  key: string;
  label: string;
  status: "ok" | "warning" | "error";
  value: string;
  detail?: string;
}

export interface SystemDiagnostics {
  checkedAt: string;
  termux: {
    detected: boolean;
    prefix: string | null;
    home: string;
  };
  processes: Array<{
    name: "api" | "frpc" | "sshd";
    running: boolean;
    pid: number | null;
    detail: string;
  }>;
  files: SystemDiagnosticItem[];
}

export interface SystemConfigFile {
  key: "frpc" | "env" | "boot";
  label: string;
  path: string;
  exists: boolean;
  content: string;
}

export interface SystemActionResponse {
  ok: boolean;
  action: SystemActionName;
  message: string;
}

export interface ManagedService {
  name: ServiceName;
  label: string;
  description: string;
  status: "running" | "stopped" | "unknown";
  pid?: number;
  logName: LogName;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
}

export interface LogResponse {
  service: LogName;
  lines: string[];
}
