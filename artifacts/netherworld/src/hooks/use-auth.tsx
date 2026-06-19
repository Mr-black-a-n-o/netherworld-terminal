import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  role: string | null;
  username: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (token: string, role: string, username: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<string | null>(localStorage.getItem("netherworld_role"));
  const [username, setUsername] = useState<string | null>(localStorage.getItem("netherworld_username"));
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const logoutMutation = useLogout();

  const checkSession = async () => {
    if (localStorage.getItem("netherworld_role") !== "user") return;
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 403) {
        setRole(null);
        setUsername(null);
        localStorage.removeItem("netherworld_role");
        localStorage.removeItem("netherworld_username");
        setLocation("/login?blocked=1");
      }
    } catch (e) {
      console.error("Session check error:", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setRole(data.role);
          setUsername(data.username);
          localStorage.setItem("netherworld_role", data.role);
          localStorage.setItem("netherworld_username", data.username);
        } else {
          setRole(null);
          setUsername(null);
          localStorage.removeItem("netherworld_role");
          localStorage.removeItem("netherworld_username");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    init();

    const interval = setInterval(checkSession, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (token: string, newRole: string, newUsername: string) => {
    setRole(newRole);
    setUsername(newUsername);
    localStorage.setItem("netherworld_role", newRole);
    localStorage.setItem("netherworld_username", newUsername);
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    }
    setRole(null);
    setUsername(null);
    localStorage.removeItem("netherworld_role");
    localStorage.removeItem("netherworld_username");
    setLocation("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        username,
        isAdmin: role === "admin",
        isAuthenticated: !!role,
        login: handleLogin,
        logout: handleLogout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
