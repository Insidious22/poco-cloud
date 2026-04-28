import type {
  AuthResponse,
  LogName,
  SystemActionName,
  SystemActionResponse,
  SystemConfigFile,
  SystemDiagnostics
} from "@poco-cloud/shared";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  timeout: 15000
});

export const tokenStore = {
  get: () => localStorage.getItem("poco_cloud_token"),
  set: (token: string) => localStorage.setItem("poco_cloud_token", token),
  clear: () => localStorage.removeItem("poco_cloud_token")
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
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
  systemAction: async (action: SystemActionName) => {
    const { data } = await api.post<SystemActionResponse>(`/api/system/actions/${action}`);
    return data;
  },
  services: async () => {
    const { data } = await api.get("/api/services");
    return data;
  },
  startService: async (name: string) => api.post(`/api/services/${name}/start`),
  stopService: async (name: string) => api.post(`/api/services/${name}/stop`),
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
