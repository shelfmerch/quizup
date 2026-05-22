import { API_URL } from "@/config/env";

export interface CommunityAuthor {
  _id: string;
  username: string;
  avatarUrl: string;
  displayName: string;
}

export interface CommunityComment {
  _id: string;
  authorId: CommunityAuthor;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  _id: string;
  categoryId: string;
  authorId: CommunityAuthor;
  content: string;
  imageUrl: string | null;
  videoUrl?: string | null;
  likes: string[];
  comments: CommunityComment[];
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

  createPost: async (
    categoryId: string,
    content: string,
    media?: { imageUrl?: string; videoUrl?: string }
  ): Promise<CommunityPost> => {
    const res = await fetch(`${API_URL}/community/${categoryId}/posts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        content,
        imageUrl: media?.imageUrl,
        videoUrl: media?.videoUrl,
      }),
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

  addComment: async (postId: string, text: string): Promise<CommunityPost> => {
    const res = await fetch(`${API_URL}/community/post/${postId}/comments`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw { response: { data } };
    return data.post;
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);

    const token = localStorage.getItem("quizup_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${API_URL}/community/upload-image`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw { response: { data }, message: (data as { error?: string }).error || "Failed to upload image" };
    }
    return (data as { imageUrl: string }).imageUrl;
  },

  uploadVideo: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("video", file);

    const token = localStorage.getItem("quizup_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${API_URL}/community/upload-video`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw { response: { data }, message: (data as { error?: string }).error || "Failed to upload video" };
    }
    return (data as { videoUrl: string }).videoUrl;
  },
};
