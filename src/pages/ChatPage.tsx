import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Camera, Smile, MoreVertical, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { chatRoomId, chatService } from "@/services/chatService";
import { markChatRead } from "@/services/chatApi";
import { profileService } from "@/services/profileService";
import { resolveMediaUrl } from "@/config/env";
import { ChatMessage, Profile } from "@/types";

// ── helpers ──────────────────────────────────────────────────────────────────
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Group consecutive messages by the same sender within 2 minutes
function groupMessages(msgs: ChatMessage[]) {
  return msgs.map((msg, i) => {
    const prev = msgs[i - 1];
    const sameChain =
      prev &&
      prev.senderId === msg.senderId &&
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 120_000;
    return { msg, isFirst: !sameChain };
  });
}

// ── Bubble ───────────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: ChatMessage;
  isMe: boolean;
  isFirst: boolean;
  peerAvatar: string;
}

const Bubble: React.FC<BubbleProps> = ({ msg, isMe, isFirst, peerAvatar }) => {
  const avatar = resolveMediaUrl(msg.senderAvatar) || peerAvatar;
  const mediaUrl = msg.mediaUrl;
  const mediaType = msg.mediaType;
  const isMediaOnly = !!mediaUrl && !msg.text;

  return (
    <div className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      {/* Peer avatar — only for first bubble in chain */}
      {!isMe && (
        <div className="w-7 shrink-0">
          {isFirst && (
            <img
              src={avatar}
              alt=""
              className="w-7 h-7 rounded-full object-cover border border-white/30"
            />
          )}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
        <div
          className={`relative text-[14px] leading-snug shadow-sm overflow-hidden ${
            isMediaOnly ? "p-0" : "px-3 py-2"
          } ${
            isMe
              ? "bg-[#dcf8c6] text-[#111] rounded-t-2xl rounded-bl-2xl rounded-br-sm"
              : "bg-white text-[#111] rounded-t-2xl rounded-br-2xl rounded-bl-sm"
          }`}
          style={{ wordBreak: "break-word" }}
        >
          {/* Tail */}
          {isFirst && (
            <span
              className={`absolute bottom-0 w-2.5 h-2.5 z-10 ${
                isMe
                  ? "right-[-7px] text-[#dcf8c6]"
                  : "left-[-7px] text-white"
              }`}
              style={{ lineHeight: 1 }}
            >
              {isMe ? (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-[#dcf8c6]">
                  <path d="M0 0 Q10 0 10 10 L0 10 Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-white">
                  <path d="M10 0 Q0 0 0 10 L10 10 Z" />
                </svg>
              )}
            </span>
          )}
          {/* Media */}
          {mediaUrl && (
            <div className={isMediaOnly ? "" : "mb-1"}>
              {(mediaType || "").startsWith("video") ? (
                <video
                  src={mediaUrl}
                  controls
                  className={`block ${
                    isMediaOnly ? "max-w-[260px] max-h-60 rounded-2xl" : "max-w-full max-h-52 rounded-xl"
                  }`}
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt=""
                  className={`block object-cover ${
                    isMediaOnly ? "max-w-[260px] max-h-60 rounded-2xl" : "max-w-full max-h-52 rounded-xl"
                  }`}
                />
              )}
              {/* Timestamp overlay on media-only bubbles */}
              {isMediaOnly && (
                <span className="absolute bottom-1.5 right-2.5 text-[10px] text-white drop-shadow bg-black/30 rounded px-1">
                  {formatTime(msg.createdAt)}
                </span>
              )}
            </div>
          )}
          {msg.text && <span>{msg.text}</span>}
        </div>
        {/* Timestamp (only for non-media-only) */}
        {!isMediaOnly && (
          <span className="text-[10px] text-black/40 px-1">{formatTime(msg.createdAt)}</span>
        )}
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
const ChatPage: React.FC = () => {
  const { peerId } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [peer, setPeer] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: string; file: File } | null>(null);
  const [mediaSending, setMediaSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roomId = useMemo(() => {
    if (!user?.id || !peerId) return "";
    return chatRoomId(user.id, peerId);
  }, [user?.id, peerId]);

  // Load peer profile
  useEffect(() => {
    if (!peerId) return;
    profileService.getProfile(peerId).then(setPeer).catch(() => setPeer(null));
  }, [peerId]);

  // Mark read on mount
  useEffect(() => {
    if (!peerId || !user?.id) return;
    markChatRead(peerId).catch(() => {});
  }, [peerId, user?.id]);

  // Message handler
  const handleMessage = useCallback(
    (msg: ChatMessage & { localId?: string }) => {
      setMessages((prev) => {
        // If this message has a localId (it was sent by us optimistically),
        // replace the optimistic bubble instead of duplicating it
        if (msg.localId) {
          const index = prev.findIndex((m) => m.id === msg.localId);
          if (index !== -1) {
            const next = [...prev];
            next[index] = msg;
            return next;
          }
        }
        // Avoid duplicate by ID
        if (prev.some((m) => m.id === msg.id)) return prev;

        return [...prev, msg];
      });
      if (peerId && msg.senderId !== user?.id) markChatRead(peerId).catch(() => {});
    },
    [peerId, user?.id]
  );
  const handleHistory = useCallback((rows: ChatMessage[]) => setMessages(rows), []);

  useEffect(() => {
    if (!roomId) return;
    chatService.joinRoom(roomId, handleMessage, handleHistory);
    return () => chatService.leaveRoom(roomId, handleMessage, handleHistory);
  }, [roomId, handleMessage, handleHistory]);

  // Auto-scroll
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

  const handleMediaPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaPreview({ url, type: file.type, file });
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  const clearMedia = (revokeUrl = true) => {
    if (revokeUrl && mediaPreview) URL.revokeObjectURL(mediaPreview.url);
    setMediaPreview(null);
    setMediaSending(false);
  };

  const handleSendMedia = async () => {
    if (!mediaPreview || !roomId || mediaSending) return;
    setMediaSending(true);

    const localId = `local-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: localId,
      roomId,
      senderId: user?.id ?? "",
      senderName: user?.username ?? "",
      senderAvatar: user?.avatarUrl ?? "",
      text: "",
      mediaUrl: mediaPreview.url,
      mediaType: mediaPreview.type,
      createdAt: new Date().toISOString(),
      read: true,
    };

    setMessages((prev) => [...prev, optimistic]);

    const { file, url: objectUrl } = mediaPreview;
    clearMedia(false); // Don't revoke — URL is now live in the optimistic message bubble

    try {
      // 1. Upload to S3
      const { mediaUrl, mediaType } = await chatService.uploadMedia(file);
      
      // 2. Send via socket (pass localId so the server can echo it back for deduplication)
      chatService.sendMessage(roomId, "", mediaUrl, mediaType, localId);
    } catch (error) {
      console.error("Media upload failed:", error);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      URL.revokeObjectURL(objectUrl);
    }
  };

  const peerName = peer?.displayName || peer?.username || "Chat";
  const peerAvatar =
    resolveMediaUrl(peer?.avatarUrl) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(peerName)}`;

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  const BRAND = "#e05a3a"; // lighter warm-red

  return (
    <div
      className="h-[100dvh] flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ background: "#e5ddd5" }}
    >
      {/* ── WhatsApp-style header ────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-3 px-2 py-2 shadow-md z-20"
        style={{ background: BRAND }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-full active:bg-white/10 text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Avatar — navigates to profile */}
        <button
          onClick={() => navigate(`/profile/${peerId}`)}
          className="shrink-0 focus:outline-none"
        >
          <img
            src={peerAvatar}
            alt={peerName}
            className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(peerName)}`;
            }}
          />
        </button>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] truncate leading-tight">{peerName}</p>
          <p className="text-[11px] text-[#b2dfdb]">tap to view profile</p>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-white">
          {/* <button className="p-2 rounded-full active:bg-white/10">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full active:bg-white/10">
            <Phone className="w-5 h-5" />
          </button> */}
          <button className="p-2 rounded-full active:bg-white/10">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Message area with tiled background ──────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
        style={{
          backgroundImage: "url('/images/chat_back.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "auto",
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-sm flex flex-col items-center gap-2 max-w-[220px]">
              <img src={peerAvatar} alt="" className="w-14 h-14 rounded-full border-2 border-white shadow" />
              <p className="text-[13px] text-[#111]/70 font-medium leading-snug">
                Say hi to <span style={{ color: BRAND }} className="font-bold">{peerName}</span>!<br />
                <span className="text-[11px] font-normal text-[#111]/50">Messages are end-to-end encrypted.</span>
              </p>
            </div>
          </div>
        )}

        {/* Bubbles */}
        {grouped.map(({ msg, isFirst }) => (
          <Bubble
            key={msg.id}
            msg={msg}
            isMe={msg.senderId === user?.id}
            isFirst={isFirst}
            peerAvatar={peerAvatar}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Media preview bar ───────────────────────────────────────────── */}
      {mediaPreview && (
        <div className="shrink-0 bg-white border-t border-black/10 px-3 py-2 flex items-center gap-3">
          <div className="relative">
            {mediaPreview.type.startsWith("video") ? (
              <video src={mediaPreview.url} className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <img src={mediaPreview.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
            )}
            <button
              onClick={clearMedia}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
          <div className="flex-1 text-[13px] text-[#555] truncate">
            {mediaPreview.type.startsWith("video") ? "Video ready to send" : "Photo ready to send"}
          </div>
          <button
            onClick={handleSendMedia}
            disabled={mediaSending}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform disabled:opacity-60"
            style={{ background: BRAND }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleMediaPick}
      />
      <div
        className="shrink-0 flex items-center gap-2 px-2 py-2 z-20"
        style={{ background: "#f0f0f0" }}
      >
        {/* Text field */}
        <div className="flex-1 flex items-center bg-white rounded-full px-4 gap-2 shadow-sm min-h-[44px]">
          <button className="opacity-60 hover:opacity-100 shrink-0" style={{ color: BRAND }}>
            <Smile className="w-5 h-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message"
            className="flex-1 text-[14px] text-[#111] placeholder:text-[#aaa] bg-transparent outline-none py-2"
          />
        </div>

        {/* Camera button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-11 h-11 rounded-full flex items-center justify-center shadow-md shrink-0 active:scale-95 transition-transform"
          style={{ background: BRAND }}
        >
          <Camera className="w-5 h-5 text-white" />
        </button>

        {/* Send FAB (only when text) */}
        {text.trim() && (
          <button
            type="button"
            onClick={handleSend}
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0"
            style={{ background: BRAND }}
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
