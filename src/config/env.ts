const trimSlash = (u: string) => u.replace(/\/+$/, "");

/**
 * Backend HTTP origin only — no path. Set in `.env` as `VITE_API_URL`.
 * REST calls use `${API_BASE}/api/...`. Media is stored on S3; legacy `/uploads/...` paths redirect to S3.
 * @example VITE_API_URL=http://localhost:3003
 * @example VITE_API_URL=https://api.yourdomain.com
 */
const defaultApiBase = import.meta.env.PROD ? "" : "http://localhost:3003";
const rawApiBase = import.meta.env.VITE_API_URL ?? defaultApiBase;
export const API_BASE = trimSlash(rawApiBase).replace(/\/api$/, "");

export const API_URL = API_BASE ? `${API_BASE}/api` : "/api";

/**
 * Socket.io server origin. Defaults to `API_BASE` when unset (same host:port as the API).
 * Override if the WebSocket endpoint differs (e.g. separate ws subdomain).
 */
export const SOCKET_URL = trimSlash(import.meta.env.VITE_SOCKET_URL ?? API_BASE);

/** Giphy API key for in-chat GIF search (client-side; set `VITE_GIPHY_API_KEY` in `.env`). */
export const GIPHY_API_KEY = (import.meta.env.VITE_GIPHY_API_KEY ?? "").trim();

export { resolveMediaUrl } from "@/lib/mediaUrl";
