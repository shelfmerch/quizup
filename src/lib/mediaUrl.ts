import { API_BASE } from "@/config/env";

/** Virtual-hosted S3 URLs (private bucket → API media proxy). */
function isOurS3HttpUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.includes(".s3.") && host.endsWith(".amazonaws.com");
  } catch {
    return false;
  }
}

/** Private bucket → load via API proxy; public https and legacy /uploads unchanged. */
export function resolveQuestionImageUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl || !String(imageUrl).trim()) return undefined;
  const u = String(imageUrl).trim();
  if (u.startsWith("data:")) return u;
  if (isOurS3HttpUrl(u)) {
    try {
      const key = decodeURIComponent(new URL(u).pathname.replace(/^\/+/, ""));
      const base = API_BASE || "";
      return `${base}/api/media/file/${key.split("/").map(encodeURIComponent).join("/")}`;
    } catch {
      return u;
    }
  }
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}

export function resolveMediaUrl(
  url: string | undefined | null,
  fallback = ""
): string {
  if (url == null || String(url).trim() === "") return fallback;
  return resolveQuestionImageUrl(url) ?? fallback;
}
