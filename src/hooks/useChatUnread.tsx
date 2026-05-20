import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchChatUnreadSummary, type ChatUnreadItem } from "@/services/chatApi";
import { subscribeChatInbox } from "@/services/chatService";
import { getSocket } from "@/services/socketService";

type ChatUnreadContextValue = {
  totalUnread: number;
  unreadByPeerId: Map<string, number>;
  refresh: () => Promise<void>;
  hasUnread: (peerId: string) => boolean;
  getUnreadCount: (peerId: string) => number;
};

const ChatUnreadContext = createContext<ChatUnreadContextValue | null>(null);

export const ChatUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState<ChatUnreadItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await fetchChatUnreadSummary();
      setItems(data.items);
      setTotalUnread(data.totalUnread);
    } catch {
      /* offline or unauthenticated */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setItems([]);
      setTotalUnread(0);
      return;
    }

    try {
      getSocket();
    } catch {
      return;
    }

    refresh();
    const unsubInbox = subscribeChatInbox(() => {
      refresh();
    });

    const onFocus = () => {
      refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      unsubInbox();
      window.removeEventListener("focus", onFocus);
    };
  }, [isAuthenticated, user?.id, refresh]);

  const unreadByPeerId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.peerId, item.unreadCount);
    }
    return map;
  }, [items]);

  const value = useMemo<ChatUnreadContextValue>(
    () => ({
      totalUnread,
      unreadByPeerId,
      refresh,
      hasUnread: (peerId: string) => (unreadByPeerId.get(peerId) ?? 0) > 0,
      getUnreadCount: (peerId: string) => unreadByPeerId.get(peerId) ?? 0,
    }),
    [totalUnread, unreadByPeerId, refresh]
  );

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
};

export function useChatUnread(): ChatUnreadContextValue {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) {
    throw new Error("useChatUnread must be used within ChatUnreadProvider");
  }
  return ctx;
}
