import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: sessionInfo, isLoading, error } = useGetMe({
    query: {
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  });

  const logoutMutation = useLogout();

  useEffect(() => {
    if (sessionInfo) {
      setRole(sessionInfo.role);
      setUsername(sessionInfo.username);
      localStorage.setItem("netherworld_role", sessionInfo.role);
      localStorage.setItem("netherworld_username", sessionInfo.username);
    } else if (error) {
      setRole(null);
      setUsername(null);
      localStorage.removeItem("netherworld_role");
      localStorage.removeItem("netherworld_username");
    }
  }, [sessionInfo, error]);

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
