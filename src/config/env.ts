const trimSlash = (u: string) => u.replace(/\/+$/, "");

/**
 * Backend HTTP origin only — no path. Set in `.env` as `VITE_API_URL`.
 * REST calls use `${API_BASE}/api/...`; static uploads use `${API_BASE}/uploads/...`.
 * @example VITE_API_URL=http://localhost:3001
 * @example VITE_API_URL=https://api.yourdomain.com
 */
export const API_BASE = trimSlash(import.meta.env.VITE_API_URL ?? "http://localhost:3001");

export const API_URL = `${API_BASE}/api`;

/**
 * Socket.io server origin. Defaults to `API_BASE` when unset (same host:port as the API).
 * Override if the WebSocket endpoint differs (e.g. separate ws subdomain).
 */
export const SOCKET_URL = trimSlash(import.meta.env.VITE_SOCKET_URL ?? API_BASE);
