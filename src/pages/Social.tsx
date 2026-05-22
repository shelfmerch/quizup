import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Search, Users } from "lucide-react";
import { fetchChatConversations, type ChatConversation } from "@/services/chatApi";
import { useChatUnread } from "@/hooks/useChatUnread";
import { subscribeChatInbox } from "@/services/chatService";
import { resolveMediaUrl } from "@/config/env";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OnlineIndicator } from "@/components/ui/OnlineIndicator";


const BRAND = "#128c7e";

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const RowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e9edef] animate-pulse">
    <div className="w-[49px] h-[49px] rounded-full bg-[#e9edef] shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-32 rounded bg-[#e9edef]" />
      <div className="h-3 w-48 rounded bg-[#e9edef]" />
    </div>
  </div>
);

interface ConversationRowProps {
  conv: ChatConversation;
  isOnline: boolean;
  onOpen: () => void;
}

const ConversationRow: React.FC<ConversationRowProps> = ({ conv, isOnline, onOpen }) => {
  const name = conv.displayName || conv.username;
  const avatar =
    resolveMediaUrl(conv.avatarUrl) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(conv.username)}`;
  const hasUnread = conv.unreadCount > 0;

  // Mask encrypted message previews — never show raw ciphertext to the user
  const preview = conv.lastMessagePreview?.startsWith("e2e:")
    ? "🔒 Encrypted message"
    : conv.lastMessagePreview;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-[#e9edef] hover:bg-[#f5f6f6] active:bg-[#ebebeb] transition-colors text-left"
    >
      <div className="relative shrink-0">
        <img
          src={avatar}
          alt=""
          className="w-[49px] h-[49px] rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(conv.username)}`;
          }}
        />
        <OnlineIndicator
          isOnline={isOnline}
          className="absolute top-0 right-0 border-2 border-white rounded-full"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`truncate text-[16px] leading-tight ${
              hasUnread ? "font-semibold text-[#111b21]" : "font-normal text-[#111b21]"
            }`}
          >
            {name}
          </p>
          <span
            className={`shrink-0 text-[12px] ${
              hasUnread ? "font-medium text-[#25d366]" : "text-[#667781]"
            }`}
          >
            {formatChatTime(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={`truncate text-[14px] leading-snug ${
              hasUnread ? "font-medium text-[#111b21]" : "text-[#667781]"
            }`}
          >
            {preview}
          </p>
          {hasUnread && (
            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#25d366] text-white text-[11px] font-semibold flex items-center justify-center">
              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const Social: React.FC = () => {
  const navigate = useNavigate();
  const { refresh: refreshUnread } = useChatUnread();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const peerIds = useMemo(() => conversations.map((c) => c.peerId), [conversations]);
  const { isOnline } = useOnlineStatus(peerIds);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchChatConversations();
      setConversations(data.conversations);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeChatInbox(() => {
      load();
      refreshUnread();
    });
    return unsub;
  }, [load, refreshUnread]);

  useEffect(() => {
    const onFocus = () => {
      load();
      refreshUnread();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load, refreshUnread]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        // Only search plaintext previews — skip encrypted payloads
        (!c.lastMessagePreview?.startsWith("e2e:") &&
          c.lastMessagePreview.toLowerCase().includes(q))
    );
  }, [conversations, query]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="sticky top-0 z-20 shrink-0" style={{ background: BRAND }}>
        <div className="flex items-center gap-2 px-2 py-2 text-white">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="p-2 rounded-full active:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 font-semibold text-[19px]">Chats</h1>
          <button
            type="button"
            onClick={() => navigate("/people")}
            className="p-2 rounded-full active:bg-white/10"
            aria-label="Find people"
            title="People"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667781] pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white text-[14px] text-[#111b21] placeholder:text-[#667781] outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <MessageCircle className="w-14 h-14 text-[#667781]/40 mb-4" />
            <p className="text-[17px] font-medium text-[#111b21]">
              {query ? "No chats found" : "No chats yet"}
            </p>
            <p className="text-[14px] text-[#667781] mt-2 max-w-[260px] leading-snug">
              {query
                ? "Try another name or message"
                : "Message players from People to start a conversation."}
            </p>
            {!query && (
              <button
                type="button"
                onClick={() => navigate("/people")}
                className="mt-6 px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
                style={{ background: BRAND }}
              >
                Go to People
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.peerId}
              conv={conv}
              isOnline={isOnline(conv.peerId)}
              onOpen={() => navigate(`/chat/${conv.peerId}`)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Social;
