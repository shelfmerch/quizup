import { Profile, MatchHistoryEntry } from "@/types";
import { API_URL } from "@/config/env";

const getAuthHeaders = () => {
  const token = localStorage.getItem("quizup_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const profileService = {
  async getProfile(userId: string): Promise<Profile> {
    const response = await fetch(`${API_URL}/profile/${userId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch profile");
    
    // Some backend APIs might return { data: profile } or just the profile. Adjusting for common format.
    const data = await response.json();
    return data.profile || data; 
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
    const response = await fetch(`${API_URL}/profile/me`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update profile");
    const data = await response.json();
    return data.profile || data;
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

  async checkIsFollowing(userId: string): Promise<boolean> {
    const response = await fetch(`${API_URL}/follow/${userId}/status`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.isFollowing;
  },
};
