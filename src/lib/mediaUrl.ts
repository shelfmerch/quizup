import { API_BASE } from "@/config/env";

/** Turn stored question image refs into a browser-loadable URL (S3 https or API /uploads redirect). */
export function resolveQuestionImageUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl || !String(imageUrl).trim()) return undefined;
  const u = String(imageUrl).trim();
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}
