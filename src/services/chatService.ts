import { getSocket } from "./socketService";
import { ChatMessage } from "@/types";
import { API_URL } from "@/config/env";

/** Notify when someone messages you (for inbox badge). */
export function subscribeChatInbox(onInbox: () => void): () => void {
  try {
    const socket = getSocket();
    socket.on("chat:inbox", onInbox);
    return () => {
      socket.off("chat:inbox", onInbox);
    };
  } catch {
    return () => {};
  }
}

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

  /** Send a text message (optionally with a media attachment already uploaded to S3). */
  sendMessage(
    roomId: string,
    text: string,
    mediaUrl?: string,
    mediaType?: string,
    localId?: string
  ) {
    const socket = getSocket();
    socket.emit("chat:send", { roomId, text, mediaUrl: mediaUrl || "", mediaType: mediaType || "", localId });
  },

  /** Upload a media file (image/video) to S3 and return the permanent URL + MIME type. */
  async uploadMedia(file: File): Promise<{ mediaUrl: string; mediaType: string }> {
    const token = localStorage.getItem("quizup_token");
    const form = new FormData();
    form.append("media", file);
    const res = await fetch(`${API_URL}/chat/upload-media`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Upload failed");
    }
    return res.json();
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
