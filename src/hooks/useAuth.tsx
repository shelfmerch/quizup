import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Profile } from "@/types";
import { authService } from "@/services/authService";

interface AuthContextType {
  user: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<Profile>;
  signup: (username: string, email: string, password: string) => Promise<Profile>;
  logout: () => Promise<void>;
  /** Re-fetch session from `/api/auth/me` (stats, level, etc.). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.getSession().then(({ user, isAuthenticated }) => {
      setUser(user);
      setIsAuthenticated(isAuthenticated);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    const { user } = await authService.login(email, password);
    setUser(user);
    setIsAuthenticated(true);
    setIsLoading(false);
    return user;
  }, []);

  const signup = useCallback(async (username: string, email: string, password: string) => {
    setIsLoading(true);
    const { user } = await authService.signup(username, email, password);
    setUser(user);
    setIsAuthenticated(true);
    setIsLoading(false);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: next, isAuthenticated: ok } = await authService.getSession();
    setUser(next);
    setIsAuthenticated(ok);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
