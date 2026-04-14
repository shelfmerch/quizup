import { getSocket } from "./socketService";
import { ChatMessage } from "@/types";

/** Deterministic room id — same regardless of who initiates */
export function chatRoomId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join(":");
}

export const chatService = {
  /** Join a chat room and start receiving messages. */
  joinRoom(
    roomId: string,
    onMessage: (msg: ChatMessage) => void,
    onHistory?: (messages: ChatMessage[]) => void
  ) {
    const socket = getSocket();
    socket.emit("chat:join", { roomId });
    socket.on("chat:message", onMessage);
    if (onHistory) {
      socket.on("chat:history", (payload: { roomId: string; messages: ChatMessage[] }) => {
        if (payload?.roomId === roomId) onHistory(payload.messages || []);
      });
    }
  },

  /** Send a message to a room. */
  sendMessage(roomId: string, text: string) {
    const socket = getSocket();
    socket.emit("chat:send", { roomId, text });
  },

  /** Clean up listeners when the drawer closes. */
  leaveRoom(
    roomId: string,
    onMessage: (msg: ChatMessage) => void,
    onHistory?: (messages: ChatMessage[]) => void
  ) {
    const socket = getSocket();
    socket.emit("chat:leave", { roomId });
    socket.off("chat:message", onMessage);
    if (onHistory) socket.off("chat:history");
  },
};
