import { LeaderboardEntry } from "@/types";
import { API_URL } from "@/config/env";

export const leaderboardService = {
  async getGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
    const response = await fetch(`${API_URL}/leaderboard`);
    if (!response.ok) throw new Error("Failed to fetch global leaderboard");
    const data = await response.json();
    return data.leaderboard || data || [];
  },

  async getCategoryLeaderboard(categoryId: string): Promise<LeaderboardEntry[]> {
    const response = await fetch(`${API_URL}/leaderboard/${categoryId}`);
    if (!response.ok) throw new Error("Failed to fetch category leaderboard");
    const data = await response.json();
    return data.leaderboard || data || [];
  },
};
