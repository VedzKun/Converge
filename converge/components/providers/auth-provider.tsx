// ============================================
// AUTH CONTEXT PROVIDER
// Client-side authentication state management
// ============================================

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { SafeUser, LoginCredentials, RegisterCredentials } from "@/types";

// ============================================
// TYPES
// ============================================

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: SafeUser | null;
  initialToken?: string | null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialToken = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<SafeUser | null>(initialUser);
  const [token, setToken] = useState<string | null>(initialToken);
  const [isLoading, setIsLoading] = useState(!initialUser);

  // ==========================================
  // INITIAL AUTH CHECK
  // ==========================================

  useEffect(() => {
    if (!initialUser) {
      refreshUser();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================
  // REFRESH USER
  // ==========================================

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ==========================================
  // LOGIN
  // ==========================================

  const login = useCallback(
    async (
      credentials: LoginCredentials
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error || "Login failed" };
        }

        setUser(data.user);
        setToken(data.token);

        return { success: true };
      } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: "Network error" };
      }
    },
    []
  );

  // ==========================================
  // REGISTER
  // ==========================================

  const register = useCallback(
    async (
      credentials: RegisterCredentials
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error || "Registration failed" };
        }

        setUser(data.user);
        setToken(data.token);

        return { success: true };
      } catch (error) {
        console.error("Register error:", error);
        return { success: false, error: "Network error" };
      }
    },
    []
  );

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setToken(null);
    }
  }, []);

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
