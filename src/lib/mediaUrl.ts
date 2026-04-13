import { API_BASE } from "@/config/env";

/** Turn stored question image refs into a browser-loadable URL (API host + /uploads paths). */
export function resolveQuestionImageUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl || !String(imageUrl).trim()) return undefined;
  const u = String(imageUrl).trim();
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}
