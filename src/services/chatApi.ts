import { API_URL } from "@/config/env";

function headers(): HeadersInit {
  const token = localStorage.getItem("quizup_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type ChatUnreadItem = {
  roomId: string;
  peerId: string;
  unreadCount: number;
  username: string;
  displayName: string;
  avatarUrl: string;
};

export async function fetchChatUnreadSummary(): Promise<{ items: ChatUnreadItem[]; totalUnread: number }> {
  const res = await fetch(`${API_URL}/chat/unread-summary`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load chat notifications");
  return res.json();
}

export async function markChatRead(peerId: string): Promise<void> {
  const res = await fetch(`${API_URL}/chat/read`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ peerId }),
  });
  if (!res.ok) throw new Error("Failed to mark read");
}
