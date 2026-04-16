import { API_URL } from "@/config/env";
import { Category } from "@/types";

const getAuthHeaders = () => {
  const token = localStorage.getItem("quizup_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export async function fetchPublicCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load topics");
  }
  const data = await res.json();
  return data.categories as Category[];
}

export async function fetchFollowedCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories/followed`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load followed topics");
  }
  const data = await res.json();
  return (data.categories ?? []) as Category[];
}

export async function followCategory(slug: string): Promise<void> {
  const res = await fetch(`${API_URL}/categories/${encodeURIComponent(slug)}/follow`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to follow topic");
  }
}

export async function unfollowCategory(slug: string): Promise<void> {
  const res = await fetch(`${API_URL}/categories/${encodeURIComponent(slug)}/follow`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to unfollow topic");
  }
}
