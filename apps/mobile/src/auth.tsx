import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "./api";
import { deleteStoredItem, getStoredItem, setStoredItem } from "./storage";
import type { User } from "./types";

const TOKEN_KEY = "educar.mobile.token";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await getStoredItem(TOKEN_KEY);
        if (!stored) return;
        const result = await apiRequest<{ user: User }>("/me", { token: stored });
        if (active) {
          setToken(stored);
          setUser(result.user);
        }
      } catch {
        await deleteStoredItem(TOKEN_KEY);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function login(username: string, password: string): Promise<User> {
    const result = await apiRequest<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    await setStoredItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }

  async function logout(): Promise<void> {
    await deleteStoredItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
