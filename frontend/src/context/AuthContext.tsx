"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { AuthResponse, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "healthy_agent_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() =>
    typeof window !== "undefined" ? !!localStorage.getItem(TOKEN_KEY) : true,
  );
  const router = useRouter();

  // Saat app pertama kali load: cek apakah ada token tersimpan,
  // kalau ada, validasi ke /api/me untuk dapat data user terbaru.
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);

    if (!savedToken) {
      return;
    }

    api
      .get<User>("/me", savedToken)
      .then((userData) => {
        setToken(savedToken);
        setUser(userData);
      })
      .catch(() => {
        // Token invalid/expired, bersihkan.
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function saveSession(data: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const data = await api.post<AuthResponse>("/login", { email, password });
    saveSession(data);
  }

  async function register(
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string
  ) {
    const data = await api.post<AuthResponse>("/register", {
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
    });
    saveSession(data);
  }

  async function logout() {
    try {
      if (token) await api.post("/logout", undefined, token);
    } catch {
      // Kalau gagal (misal token sudah expired duluan), tetap lanjut
      // bersihkan sesi lokal, tidak perlu blokir user.
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      router.push("/login");
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

export { ApiError };
