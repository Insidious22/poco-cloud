import type { AuthUser } from "@poco-cloud/shared";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../services/api.js";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiClient.me();
        setUser(response.user);
      } catch {
        /* session cookie invalid or missing */
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (username, password) => {
        const response = await apiClient.login(username, password);
        setUser(response.user);
      },
      logout: async () => {
        await apiClient.logout().catch(() => undefined);
        setUser(null);
      }
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
