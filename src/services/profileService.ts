import { Profile, MatchHistoryEntry } from "@/types";
import { API_URL } from "@/config/env";

const getAuthHeaders = () => {
  const token = localStorage.getItem("quizup_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const getAuthToken = (): Record<string, string> => {
  const token = localStorage.getItem("quizup_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const profileService = {
  async getProfile(userId: string): Promise<Profile> {
    const response = await fetch(`${API_URL}/profile/${userId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch profile");
    
    const data = await response.json();
    // Backend returns `{ user: profile }`
    return data.user || data.profile || data;
  },

  async getMatchHistory(userId: string, limit = 20): Promise<MatchHistoryEntry[]> {
    const q = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`${API_URL}/profile/${userId}/history?${q}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch match history");
    const data = await response.json();
    return Array.isArray(data.history) ? data.history : [];
  },

  async updateProfile(updates: Partial<Profile>): Promise<Profile> {
    const response = await fetch(`${API_URL}/profile`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update profile");
    const data = await response.json();
    return data.user || data.profile || data;
  },

  async followUser(userId: string): Promise<void> {
    const response = await fetch(`${API_URL}/follow/${userId}`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to follow user");
  },

  async unfollowUser(userId: string): Promise<void> {
    const response = await fetch(`${API_URL}/follow/${userId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to unfollow user");
  },

  async getFollowingUsers(): Promise<{ id: string; username: string; displayName: string; avatarUrl: string; level: number; country: string }[]> {
    const response = await fetch(`${API_URL}/follow/following`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.following) ? data.following : [];
  },

  async checkIsFollowing(userId: string): Promise<boolean> {
    const response = await fetch(`${API_URL}/follow/${userId}/status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.isFollowing;
  },

  async uploadAvatar(file: File): Promise<Profile> {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await fetch(`${API_URL}/profile/avatar`, {
      method: "PUT",
      headers: getAuthToken(), // Using getAuthToken instead of getAuthHeaders to let browser set Content-Type with boundary
      body: formData,
    });
    
    if (!response.ok) throw new Error("Failed to upload avatar");
    const data = await response.json();
    return data.user || data.profile || data;
  },
};

