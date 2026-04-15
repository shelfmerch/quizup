const trimSlash = (u: string) => u.replace(/\/+$/, "");

/**
 * Backend HTTP origin only — no path. Set in `.env` as `VITE_API_URL`.
 * REST calls use `${API_BASE}/api/...`; static uploads use `${API_BASE}/uploads/...`.
 * @example VITE_API_URL=http://localhost:3001
 * @example VITE_API_URL=https://api.yourdomain.com
 */
const defaultApiBase = import.meta.env.PROD ? "" : "http://localhost:3001";
export const API_BASE = trimSlash(import.meta.env.VITE_API_URL ?? defaultApiBase);

export const API_URL = API_BASE ? `${API_BASE}/api` : "/api";

/**
 * Socket.io server origin. Defaults to `API_BASE` when unset (same host:port as the API).
 * Override if the WebSocket endpoint differs (e.g. separate ws subdomain).
 */
export const SOCKET_URL = trimSlash(import.meta.env.VITE_SOCKET_URL ?? API_BASE);

/**
 * Turn stored avatar/media paths into a browser-loadable URL.
 * The API stores paths like `/uploads/avatars/...` on the user document; the browser must request them from `API_BASE`.
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
