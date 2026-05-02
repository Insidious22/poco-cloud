import type {
  AuthResponse,
  SshAccessOverview,
  LogName,
  SystemActionName,
  SystemActionResponse,
  SystemConfigFile,
  SystemDiagnostics
} from "@poco-cloud/shared";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  timeout: 15000,
  withCredentials: true
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (location.pathname !== "/login") location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  login: async (username: string, password: string) => {
    const { data } = await api.post<AuthResponse>("/auth/login", { username, password });
    return data;
  },
  register: async (username: string, password: string, displayName?: string) => {
    const { data } = await api.post<AuthResponse>("/auth/register", {
      username,
      password,
      displayName
    });
    return data;
  },
  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  },
  logout: async () => {
    const { data } = await api.post("/auth/logout");
    return data;
  },
  logoutAll: async () => {
    const { data } = await api.post("/auth/logout-all");
    return data;
  },
  sessions: async () => {
    const { data } = await api.get("/auth/sessions");
    return data;
  },
  systemStatus: async () => {
    const { data } = await api.get("/api/system/status");
    return data;
  },
  systemDiagnostics: async () => {
    const { data } = await api.get<SystemDiagnostics>("/api/system/diagnostics");
    return data;
  },
  systemConfig: async () => {
    const { data } = await api.get<SystemConfigFile[]>("/api/system/config");
    return data;
  },
  bootLogs: async () => {
    const { data } = await api.get<{ service: "boot"; lines: string[] }>("/api/system/logs/boot");
    return data;
  },
  sshAccess: async () => {
    const { data } = await api.get<SshAccessOverview>("/api/system/ssh/access");
    return data;
  },
  addSshKey: async (label: string, publicKey: string, password: string) => {
    const { data } = await api.post("/api/system/ssh/keys", { label, publicKey, password });
    return data;
  },
  deleteSshKey: async (id: string, password: string) => {
    const { data } = await api.delete(`/api/system/ssh/keys/${id}`, { data: { password } });
    return data;
  },
  systemAction: async (action: SystemActionName, password: string) => {
    const { data } = await api.post<SystemActionResponse>(`/api/system/actions/${action}`, { password });
    return data;
  },
  services: async () => {
    const { data } = await api.get("/api/services");
    return data;
  },
  startService: async (name: string, password: string) => api.post(`/api/services/${name}/start`, { password }),
  stopService: async (name: string, password: string) => api.post(`/api/services/${name}/stop`, { password }),
  logs: async (service: LogName) => {
    const { data } = await api.get(`/api/logs/${service}`);
    return data;
  },
  listFiles: async (path: string) => {
    const { data } = await api.post("/api/files/list", { path });
    return data;
  },
  mkdir: async (path: string, name: string) => api.post("/api/files/mkdir", { path, name }),
  deletePath: async (path: string) => api.delete("/api/files", { data: { path } }),
  upload: async (path: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/files/upload?path=${encodeURIComponent(path)}`, form);
  }
};
