import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "@/config/env";

let socket: Socket | null = null;

/**
 * Shared Socket.io connection (JWT from localStorage). Same server as REST API.
 *
 * Reconnection strategy:
 *  - Automatic reconnection with exponential back-off (1 s → 30 s max).
 *  - Unlimited attempts — the app will keep retrying until it succeeds.
 *  - On Android, call onResumeReconnect() when the app returns from the background
 *    to force-reconnect immediately without waiting for the next retry timer.
 */
export function getSocket(): Socket {
  const token = localStorage.getItem("quizup_token");
  if (!token) {
    throw new Error("Not authenticated — log in to play online.");
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      // Prefer WebSocket; fall back to polling if WS is blocked
      transports: ["websocket", "polling"],
      autoConnect: true,
      // Robust reconnection configuration
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,       // start at 1 s
      reconnectionDelayMax: 30000,   // cap at 30 s
      randomizationFactor: 0.5,      // jitter to avoid thundering-herd
      timeout: 20000,                // connection timeout
    });

    if (import.meta.env.DEV) {
      socket.on("connect", () =>
        console.debug("[socket] connected:", socket?.id)
      );
      socket.on("disconnect", (reason) =>
        console.debug("[socket] disconnected:", reason)
      );
      socket.on("connect_error", (err) =>
        console.debug("[socket] connect_error:", err.message)
      );
      socket.on("reconnect_attempt", (n) =>
        console.debug("[socket] reconnect attempt #", n)
      );
      socket.on("reconnect", () =>
        console.debug("[socket] reconnected")
      );
    }
  }

  return socket;
}

/**
 * Called when the app resumes from background (Android lifecycle) or when the
 * network comes back online.  Forces an immediate reconnect if the socket is
 * currently disconnected instead of waiting for the next retry timer.
 */
export function onResumeReconnect(): void {
  if (!socket) return; // socket was never created (user not logged in)

  if (!socket.connected) {
    // Update the auth token in case it was refreshed while the app was suspended
    const token = localStorage.getItem("quizup_token");
    if (token) {
      socket.auth = { token };
    }
    socket.connect();
  }
}

/**
 * Fully tear down the socket — called on logout.
 */
export function resetSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
