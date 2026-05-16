const trimSlash = (u: string) => u.replace(/\/+$/, "");

/**
 * Backend HTTP origin only — no path. Set in `.env` as `VITE_API_URL`.
 * REST calls use `${API_BASE}/api/...`. Media is stored on S3; legacy `/uploads/...` paths redirect to S3.
 * @example VITE_API_URL=http://localhost:3003
 * @example VITE_API_URL=https://api.yourdomain.com
 */
const defaultApiBase = import.meta.env.PROD ? "" : "http://localhost:3003";
export const API_BASE = trimSlash(import.meta.env.VITE_API_URL ?? defaultApiBase);

export const API_URL = API_BASE ? `${API_BASE}/api` : "/api";

/**
 * Socket.io server origin. Defaults to `API_BASE` when unset (same host:port as the API).
 * Override if the WebSocket endpoint differs (e.g. separate ws subdomain).
 */
export const SOCKET_URL = trimSlash(import.meta.env.VITE_SOCKET_URL ?? API_BASE);

/**
 * Turn stored avatar/media paths into a browser-loadable URL.
 * New uploads return full S3 https URLs. Legacy `/uploads/...` paths are resolved via API_BASE (redirects to S3).
 */
export function resolveMediaUrl(
  url: string | undefined | null,
  fallback = ""
): string {
  if (url == null || String(url).trim() === "") return fallback;
  const u = String(url).trim();
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/")) return `${API_BASE}${u}`;
  return u;
}
