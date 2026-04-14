import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Send } from "lucide-react";
import { ChatMessage } from "@/types";
import { chatService, chatRoomId } from "@/services/chatService";
import { useAuth } from "@/hooks/useAuth";

interface ChatDrawerProps {
  /** The other player's userId */
  peerId: string;
  peerName: string;
  peerAvatar: string;
  onClose: () => void;
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({
  peerId,
  peerName,
  peerAvatar,
  onClose,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const roomId = user ? chatRoomId(user.id, peerId) : "";

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    chatService.joinRoom(roomId, handleMessage);
    return () => {
      chatService.leaveRoom(roomId, handleMessage);
    };
  }, [roomId, handleMessage]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // wait for slide-out animation
  };

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto flex flex-col rounded-t-2xl overflow-hidden"
        style={{
          height: "72vh",
          background: "hsl(0 0% 10%)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <img
            src={peerAvatar}
            alt={peerName}
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{peerName}</p>
            <p className="text-[10px] text-white/40">Direct Message</p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <img
                src={peerAvatar}
                alt={peerName}
                className="w-14 h-14 rounded-full opacity-60"
              />
              <p className="text-white/50 text-sm">
                Start chatting with{" "}
                <span className="text-white/80 font-semibold">{peerName}</span>
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isMe && (
                  <img
                    src={msg.senderAvatar}
                    alt=""
                    className="w-7 h-7 rounded-full flex-shrink-0 mt-1"
                  />
                )}
                <div
                  className={`max-w-[70%] flex flex-col gap-0.5 ${
                    isMe ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
                      isMe
                        ? "rounded-tr-sm text-white"
                        : "rounded-tl-sm bg-white/10 text-white"
                    }`}
                    style={
                      isMe
                        ? { background: "hsl(4 78% 55%)" }
                        : {}
                    }
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-white/30 px-1">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          className="flex items-center gap-2 px-3 py-3 border-t border-white/10"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
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
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 transition-opacity"
            style={{ background: "hsl(4 78% 55%)" }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatDrawer;
