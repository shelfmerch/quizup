import { API_BASE } from "@/config/env";

const OUR_S3_HOST_RE = /^https?:\/\/([^/]+)\//i;

/** Our bucket host, e.g. quiz-blitz-arena.s3.ap-south-2.amazonaws.com */
function isOurS3HttpUrl(url: string): boolean {
  const m = url.match(OUR_S3_HOST_RE);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return host.startsWith("quiz-blitz-arena.s3.") && host.endsWith(".amazonaws.com");
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
