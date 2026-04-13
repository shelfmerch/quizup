import { API_URL } from "@/config/env";
import { Category } from "@/types";

export async function fetchPublicCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load topics");
  }
  const data = await res.json();
  return data.categories as Category[];
}
