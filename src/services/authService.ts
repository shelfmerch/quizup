import { Profile } from "@/types";
import { API_URL } from "@/config/env";
import { resetSocket } from "@/services/socketService";

const getAuthHeaders = () => {
  const token = localStorage.getItem("quizup_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

let isAuthenticated = !!localStorage.getItem("quizup_token");
let currentUser: Profile | null = null;

export const authService = {
  async login(email: string, password: string): Promise<{ user: Profile }> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Login failed");
    }

    const data = await response.json();
    localStorage.setItem("quizup_token", data.token);
    isAuthenticated = true;
    currentUser = data.user;
    return { user: currentUser! };
  },

  async googleLogin(credential: string): Promise<{ user: Profile }> {
    const response = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Google login failed");
    }

    const data = await response.json();
    localStorage.setItem("quizup_token", data.token);
    isAuthenticated = true;
    currentUser = data.user;
    return { user: currentUser! };
  },

  async signup(username: string, email: string, password: string): Promise<{ user: Profile }> {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Signup failed");
    }

    const data = await response.json();
    localStorage.setItem("quizup_token", data.token);
    isAuthenticated = true;
    currentUser = data.user;
    return { user: currentUser! };
  },

  async logout(): Promise<void> {
    localStorage.removeItem("quizup_token");
    resetSocket();
    isAuthenticated = false;
    currentUser = null;
  },

  async getSession(): Promise<{ user: Profile | null; isAuthenticated: boolean }> {
    const token = localStorage.getItem("quizup_token");
    if (!token) {
      return { user: null, isAuthenticated: false };
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Session invalid");
      }

      const data = await response.json();
      currentUser = data.user;
      isAuthenticated = true;
      return { user: currentUser, isAuthenticated: true };
    } catch (err) {
      localStorage.removeItem("quizup_token");
      isAuthenticated = false;
      currentUser = null;
      return { user: null, isAuthenticated: false };
    }
  },

  isLoggedIn(): boolean {
    return isAuthenticated;
  },

  getCurrentUser(): Profile | null {
    return currentUser;
  },
};
