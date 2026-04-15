import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { chatRoomId, chatService } from "@/services/chatService";
import { markChatRead } from "@/services/chatApi";
import { profileService } from "@/services/profileService";
import { ChatMessage, Profile } from "@/types";

const ChatPage: React.FC = () => {
  const { peerId } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [peer, setPeer] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const roomId = useMemo(() => {
    if (!user?.id || !peerId) return "";
    return chatRoomId(user.id, peerId);
  }, [user?.id, peerId]);

  useEffect(() => {
    if (!peerId) return;
    profileService
      .getProfile(peerId)
      .then(setPeer)
      .catch(() => setPeer(null));
  }, [peerId]);

  useEffect(() => {
    if (!peerId || !user?.id) return;
    markChatRead(peerId).catch(() => {});
  }, [peerId, user?.id]);

  const handleMessage = useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (peerId && msg.senderId !== user?.id) {
        markChatRead(peerId).catch(() => {});
      }
    },
    [peerId, user?.id]
  );

  const handleHistory = useCallback((rows: ChatMessage[]) => {
    setMessages(rows);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    chatService.joinRoom(roomId, handleMessage, handleHistory);
    return () => chatService.leaveRoom(roomId, handleMessage, handleHistory);
  }, [roomId, handleMessage, handleHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !roomId) return;
    chatService.sendMessage(roomId, trimmed);
    setText("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const peerName = peer?.displayName || peer?.username || "Chat";
  const peerAvatar =
    peer?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(peerName)}`;

  return (
    <div className="min-h-screen bg-quizup-dark text-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="quizup-header-red px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full active:bg-black/10">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <img src={peerAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{peerName}</p>
          <p className="text-[10px] text-white/70">Direct Message</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <img src={peerAvatar} alt="" className="w-14 h-14 rounded-full opacity-60" />
            <p className="text-white/50 text-sm">
              Start chatting with <span className="text-white/80 font-semibold">{peerName}</span>
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              {!isMe && (
                <img src={msg.senderAvatar || peerAvatar} alt="" className="w-7 h-7 rounded-full flex-shrink-0 mt-1" />
              )}
              <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
                    isMe ? "rounded-tr-sm text-white" : "rounded-tl-sm bg-white/10 text-white"
                  }`}
                  style={isMe ? { background: "hsl(4 78% 55%)" } : {}}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-white/30 px-1">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-white/10">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          className="flex-1 h-10 bg-white/10 rounded-full px-4 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-white/20"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 transition-opacity"
          style={{ background: "hsl(4 78% 55%)" }}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export default ChatPage;

