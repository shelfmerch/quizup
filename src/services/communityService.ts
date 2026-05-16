import { API_URL } from "@/config/env";

export interface CommunityPost {
  _id: string;
  categoryId: string;
  authorId: {
    _id: string;
    username: string;
    avatarUrl: string;
    displayName: string;
  };
  content: string;
  imageUrl: string | null;
  likes: string[];
  comments: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryStatus {
  playedMatches: number;
  communityUnlocked: boolean;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem("quizup_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const communityService = {
  getPosts: async (categoryId: string): Promise<CommunityPost[]> => {
    const res = await fetch(`${API_URL}/community/${categoryId}/posts`);
    if (!res.ok) throw new Error("Failed to load posts");
    const data = await res.json();
    return data.posts;
  },

  createPost: async (categoryId: string, content: string, imageUrl?: string): Promise<CommunityPost> => {
    const res = await fetch(`${API_URL}/community/${categoryId}/posts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, imageUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw { response: { data } };
    return data.post;
  },

  getStatus: async (categoryId: string): Promise<CategoryStatus> => {
    const res = await fetch(`${API_URL}/community/${categoryId}/status`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch status");
    const data = await res.json();
    return data;
  },

  likePost: async (postId: string): Promise<{ success: boolean; likes: number; liked: boolean }> => {
    const res = await fetch(`${API_URL}/community/post/${postId}/like`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to like post");
    const data = await res.json();
    return data;
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    
    // We only need the Authorization header, fetch will set Content-Type with the boundary
    const token = localStorage.getItem("quizup_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    const res = await fetch(`${API_URL}/community/upload-image`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload image");
    const data = await res.json();
    return data.imageUrl;
  }
};
