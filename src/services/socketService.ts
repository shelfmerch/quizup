import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "@/config/env";

let socket: Socket | null = null;

/**
 * Shared Socket.io connection (JWT from localStorage). Same server as REST API.
 */
export function getSocket(): Socket {
  const token = localStorage.getItem("quizup_token");
  if (!token) {
    throw new Error("Not authenticated — log in to play online.");
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
    });
  }

  return socket;
}

export function resetSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
