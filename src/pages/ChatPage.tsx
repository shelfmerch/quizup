import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Camera, Smile, MoreVertical, X, Lock, Unlock, Swords, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useChatUnread } from "@/hooks/useChatUnread";
import { chatRoomId, chatService } from "@/services/chatService";
import { markChatRead } from "@/services/chatApi";
import { profileService } from "@/services/profileService";
import { resolveMediaUrl } from "@/config/env";
import { Category, ChatMessage, MatchFoundPayload, Profile } from "@/types";
import { fetchPublicCategories } from "@/services/categoryService";
import { getSocket } from "@/services/socketService";
import { toast } from "sonner";
import { generateE2eKeypair, deriveSharedKey, encryptMessage, decryptMessage, parsePublicKeyJwk, e2eStorageKeys } from "@/utils/crypto";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OnlineIndicator } from "@/components/ui/OnlineIndicator";
import { CategoryIcon } from "@/components/CategoryIcon";


// ── helpers ──────────────────────────────────────────────────────────────────
const sameUserId = (a?: string, b?: string) => String(a || "").trim() === String(b || "").trim();

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

interface IncomingChallenge {
  id: string;
  from: { userId: string; username: string; avatarUrl: string };
  to?: { userId: string; username: string };
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  createdAt?: string;
}

type ChallengeLogEntry = {
  id: string;
  kind: "sent" | "rejected" | "accepted" | "cancelled" | "error";
  text: string;
  createdAt: string;
};

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
      {/* {!isMe && (
        <div className="w-7 shrink-0">
          {isFirst && (
            <img
              src={avatar}
              alt=""
              className="w-7 h-7 rounded-full object-cover border border-white/30"
            />
          )}
        </div>
      )} */}

      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
        <div className="relative mt-3">
          {/* Tail */}
          {isFirst && (
            <span
              className={`absolute top-0 w-2.5 h-2.5 z-10 ${
                isMe
                  ? "right-[-7px] text-[#dcf8c6]"
                  : "left-[-7px] text-white"
              }`}
              style={{ lineHeight: 1 }}
            >
              {isMe ? (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-[#dcf8c6]">
                  <path d="M0 0 L10 0 Q10 10 0 10 Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-white">
                  <path d="M10 0 L0 0 Q0 10 10 10 Z" />
                </svg>
              )}
            </span>
          )}
          <div
            className={`relative text-[14px] leading-snug shadow-sm overflow-hidden ${
              isMediaOnly ? "p-0" : "px-3 py-2"
            } ${
              isMe
                ? "bg-[#dcf8c6] text-[#111] rounded-tl-2xl rounded-b-2xl rounded-tr-sm"
                : "bg-white text-[#111] rounded-tr-2xl rounded-b-2xl rounded-tl-sm"
            }`}
            style={{ wordBreak: "break-word" }}
          >
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
        </div>
        {/* Timestamp (only for non-media-only) */}
        {!isMediaOnly && (
          <span className="text-[10px] text-black/40 px-1">{formatTime(msg.createdAt)}</span>
        )}
      </div>
    </div>
  );
};

// ── Challenge cards ───────────────────────────────────────────────────────────
const ChallengeResultCard: React.FC<{ text: string; variant: ChallengeLogEntry["kind"] }> = ({
  text,
  variant,
}) => {
  const styles: Record<ChallengeLogEntry["kind"], { bg: string; border: string; color: string }> = {
    sent: { bg: "rgba(18,140,126,0.12)", border: "rgba(18,140,126,0.25)", color: "#0d5c52" },
    accepted: { bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.3)", color: "#166534" },
    rejected: { bg: "rgba(100,100,100,0.12)", border: "rgba(100,100,100,0.2)", color: "#444" },
    cancelled: { bg: "rgba(100,100,100,0.12)", border: "rgba(100,100,100,0.2)", color: "#444" },
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", color: "#991b1b" },
  };
  const s = styles[variant];
  return (
    <div
      className="mx-auto my-2 max-w-[300px] flex items-center gap-2 text-center text-[12px] px-3 py-2 rounded-xl shadow-sm"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      <Swords className="w-3.5 h-3.5 shrink-0 opacity-70" />
      <span className="font-medium leading-snug">{text}</span>
    </div>
  );
};

interface IncomingChallengeCardProps {
  challenge: IncomingChallenge;
  peerName: string;
  responding: boolean;
  onRespond: (action: "accept" | "reject") => void;
}

const IncomingChallengeCard: React.FC<IncomingChallengeCardProps> = ({
  challenge,
  peerName,
  responding,
  onRespond,
}) => (
  <div className="mx-auto my-3 max-w-[300px] rounded-2xl bg-white shadow-md border border-[#128c7e]/20 overflow-hidden">
    <div className="px-4 py-3 text-center" style={{ background: "rgba(18,140,126,0.08)" }}>
      <div className="flex items-center justify-center gap-1.5 text-[#128c7e] mb-1">
        <Swords className="w-4 h-4" />
        <span className="text-[11px] font-bold uppercase tracking-wide">Challenge</span>
      </div>
      <p className="text-[13px] text-[#111] leading-snug flex items-center justify-center gap-1.5 flex-wrap">
        <span className="font-bold">{peerName}</span>
        <span>challenges you in</span>
        <span className="inline-flex items-center gap-1 font-bold text-[#128c7e]">
          <CategoryIcon
            category={{ name: challenge.categoryName, icon: challenge.categoryIcon }}
            size={18}
            style="fluency"
            className="h-4 w-4 object-contain"
          />
          {challenge.categoryName}
        </span>
      </p>
    </div>
    <div className="flex border-t border-black/5">
      <button
        type="button"
        disabled={responding}
        onClick={() => onRespond("reject")}
        className="flex-1 py-2.5 text-[13px] font-semibold text-[#666] active:bg-black/5 disabled:opacity-50"
      >
        Decline
      </button>
      <button
        type="button"
        disabled={responding}
        onClick={() => onRespond("accept")}
        className="flex-1 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        style={{ background: "#128c7e" }}
      >
        {responding ? "…" : "Accept"}
      </button>
    </div>
  </div>
);

// ── Page ─────────────────────────────────────────────────────────────────────
const ChatPage: React.FC = () => {
  const { peerId } = useParams<{ peerId: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { refresh: refreshUnread } = useChatUnread();
  const { isOnline } = useOnlineStatus(peerId);

  const [peer, setPeer] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: string; file: File } | null>(null);
  const [mediaSending, setMediaSending] = useState(false);

  // E2E Encryption state
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [isE2eActive, setIsE2eActive] = useState<boolean>(false);
  const [cryptoError, setCryptoError] = useState<string | null>(null);

  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [challengeSending, setChallengeSending] = useState(false);
  const [challengeResponding, setChallengeResponding] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [challengeLog, setChallengeLog] = useState<ChallengeLogEntry[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didInitialScrollRef = useRef(false);
  const peerChallengeIdsRef = useRef<Set<string>>(new Set());
  const challengePeerIdRef = useRef<string | undefined>(undefined);
  const peerNameRef = useRef("Chat");
  peerNameRef.current = peer?.displayName || peer?.username || "Chat";

  const roomId = useMemo(() => {
    if (!user?.id || !peerId) return "";
    return chatRoomId(user.id, peerId);
  }, [user?.id, peerId]);

  // Reset scroll reference on room change
  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [roomId]);

  // Load / refresh peer profile (keys can change — always fetch latest before E2E)
  const loadPeer = useCallback(async () => {
    if (!peerId) return;
    try {
      const p = await profileService.getProfile(peerId);
      setPeer(p);
    } catch {
      setPeer(null);
    }
  }, [peerId]);

  useEffect(() => {
    loadPeer();
  }, [loadPeer]);

  useEffect(() => {
    const onFocus = () => loadPeer();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPeer]);

  // Mark read on mount
  useEffect(() => {
    if (!peerId || !user?.id) return;
    markChatRead(peerId)
      .then(() => refreshUnread())
      .catch(() => {});
  }, [peerId, user?.id, refreshUnread]);

  // E2E Identity Key Generation, Registration, and Shared Key Derivation
  useEffect(() => {
    async function initE2e() {
      if (!user?.id || !peer?.id) return;

      const storage = e2eStorageKeys(user.id);
      let privateKeyJwkStr = localStorage.getItem(storage.private);
      let publicKeyJwkStr = localStorage.getItem(storage.public);

      // Never rotate keys when local storage is empty but the account already has a server key —
      // that would desync peers and make all encrypted messages undecryptable on this device.
      if ((!privateKeyJwkStr || !publicKeyJwkStr) && user.publicKeyE2e?.trim()) {
        setCryptoError(
          "Chat encryption keys are missing on this device. Use the browser where you first opened chat, or sign out and back in after clearing keys in Settings."
        );
        setSharedKey(null);
        setIsE2eActive(false);
        return;
      }

      if (!privateKeyJwkStr || !publicKeyJwkStr) {
        try {
          const { publicKeyJwk, privateKeyJwk } = await generateE2eKeypair();
          privateKeyJwkStr = JSON.stringify(privateKeyJwk);
          publicKeyJwkStr = JSON.stringify(publicKeyJwk);
          localStorage.setItem(storage.private, privateKeyJwkStr);
          localStorage.setItem(storage.public, publicKeyJwkStr);

          await profileService.updateProfile({ publicKeyE2e: publicKeyJwkStr });
          refreshUser().catch(console.error);
        } catch (err) {
          console.error("Failed to generate or upload E2E key pair:", err);
          setCryptoError("Failed to initialize E2E keypair");
          setSharedKey(null);
          setIsE2eActive(false);
          return;
        }
      } else if (!user.publicKeyE2e?.trim() || user.publicKeyE2e.trim() !== publicKeyJwkStr.trim()) {
        try {
          await profileService.updateProfile({ publicKeyE2e: publicKeyJwkStr });
          refreshUser().catch(console.error);
        } catch (err) {
          console.error("Failed to sync public E2E key to backend:", err);
        }
      }

      if (peer.publicKeyE2e?.trim()) {
        try {
          const myPrivateJwk = JSON.parse(privateKeyJwkStr) as JsonWebKey;
          const peerPublicJwk = parsePublicKeyJwk(peer.publicKeyE2e);
          const key = await deriveSharedKey(myPrivateJwk, peerPublicJwk);
          setSharedKey(key);
          setIsE2eActive(true);
          setCryptoError(null);
        } catch (err) {
          console.error("Failed to derive shared key with peer:", err);
          setCryptoError("Could not establish secure encryption with peer");
          setSharedKey(null);
          setIsE2eActive(false);
        }
      } else {
        setSharedKey(null);
        setIsE2eActive(false);
        setCryptoError(null);
      }
    }

    initE2e();
  }, [user?.id, user?.publicKeyE2e, peer?.id, peer?.publicKeyE2e, refreshUser]);

  // Async decryption effect for all loaded and incoming messages
  useEffect(() => {
    let active = true;

    async function decryptAll() {
      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          if (msg.text && msg.text.startsWith("e2e:")) {
            if (!sharedKey) {
              return {
                ...msg,
                text: "🔒 Encrypted message…",
                mediaUrl: undefined,
                mediaType: undefined,
              };
            }
            try {
              const decryptedText = await decryptMessage(sharedKey, msg.text);
              const payload = JSON.parse(decryptedText) as {
                text?: string;
                mediaUrl?: string;
                mediaType?: string;
              };
              return {
                ...msg,
                text: payload.text || "",
                mediaUrl: payload.mediaUrl || undefined,
                mediaType: payload.mediaType || undefined,
              };
            } catch (err) {
              console.error("Failed to decrypt message:", err);
              return {
                ...msg,
                text: "⚠️ Couldn't decrypt this message. Ask the sender to resend, or refresh the chat.",
                mediaUrl: undefined,
                mediaType: undefined,
              };
            }
          }
          return msg;
        })
      );

      if (active) {
        setDecryptedMessages(decrypted);
      }
    }

    decryptAll();

    return () => {
      active = false;
    };
  }, [messages, sharedKey]);

  // Message handler
  const handleMessage = useCallback(
    (msg: ChatMessage & { localId?: string }) => {
      setMessages((prev) => {
        if (msg.localId) {
          const index = prev.findIndex((m) => m.id === msg.localId);
          if (index !== -1) {
            const next = [...prev];
            next[index] = msg;
            return next;
          }
        }
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (peerId && msg.senderId !== user?.id) {
        markChatRead(peerId)
          .then(() => refreshUnread())
          .catch(() => {});
      }
    },
    [peerId, user?.id, refreshUnread]
  );
  const handleHistory = useCallback((rows: ChatMessage[]) => setMessages(rows), []);

  useEffect(() => {
    if (!roomId) return;
    chatService.joinRoom(roomId, handleMessage, handleHistory);
    return () => chatService.leaveRoom(roomId, handleMessage, handleHistory);
  }, [roomId, handleMessage, handleHistory]);

  const appendChallengeLog = useCallback((entry: Omit<ChallengeLogEntry, "id" | "createdAt">) => {
    setChallengeLog((prev) => [
      ...prev,
      { ...entry, id: `chlog-${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString() },
    ]);
  }, []);

  const ensureCategoriesLoaded = useCallback(async () => {
    if (allCategories.length > 0 || categoriesLoading) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      setAllCategories(await fetchPublicCategories());
    } catch {
      setCategoriesError("Could not load topics");
    } finally {
      setCategoriesLoading(false);
    }
  }, [allCategories.length, categoriesLoading]);

  const openChallengeModal = () => {
    if (!peerId || !user?.id) return;
    setChallengeModalOpen(true);
    void ensureCategoriesLoaded();
  };

  const sendChallengeForCategory = async (categoryIdRaw: string) => {
    if (!peerId || !user?.id) return;
    const categoryId = (categoryIdRaw || "science").trim() || "science";
    const categoryName =
      allCategories.find((c) => c.id === categoryId)?.name || categoryId;
    setChallengeSending(true);
    setChallengeModalOpen(false);
    appendChallengeLog({
      kind: "sent",
      text: `You challenged ${peerNameRef.current} in ${categoryName}`,
    });
    try {
      getSocket().emit("challenge:send", { toUserId: peerId, categoryId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send challenge";
      appendChallengeLog({ kind: "error", text: msg });
      toast.error(msg, { position: "top-center" });
      setChallengeSending(false);
    }
  };

  const respondToChallenge = (action: "accept" | "reject") => {
    const ch = incomingChallenge;
    if (!ch || challengeResponding) return;
    setChallengeResponding(true);
    try {
      getSocket().emit("challenge:respond", { challengeId: ch.id, action });
    } catch {
      setChallengeResponding(false);
    }
    if (action === "reject") {
      setIncomingChallenge(null);
      setChallengeResponding(false);
    }
  };

  const cancelOutgoingChallenge = (challengeId: string) => {
    try {
      getSocket().emit("challenge:cancel", { challengeId });
    } catch {
      /* ignore */
    }
  };

  const peerName = peer?.displayName || peer?.username || "Chat";
  const hasChallengeActivity = challengeLog.length > 0 || !!incomingChallenge;

  // Challenge socket listeners (scoped to current chat peer)
  useEffect(() => {
    if (!user?.id || !peerId) return;

    if (challengePeerIdRef.current !== peerId) {
      challengePeerIdRef.current = peerId;
      setIncomingChallenge(null);
      setChallengeLog([]);
      setChallengeModalOpen(false);
      setChallengeResponding(false);
      peerChallengeIdsRef.current = new Set();
    }

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onList = ({ incoming, outgoing }: { incoming: IncomingChallenge[]; outgoing: IncomingChallenge[] }) => {
      const fromPeer = incoming.find((c) => sameUserId(c.from.userId, peerId));
      if (fromPeer) peerChallengeIdsRef.current.add(fromPeer.id);
      setIncomingChallenge(fromPeer ?? null);
      const pendingToPeer = outgoing.find((c) => sameUserId(c.to?.userId, peerId));
      if (pendingToPeer) {
        peerChallengeIdsRef.current.add(pendingToPeer.id);
        setChallengeLog((prev) => {
          if (prev.some((e) => e.id === `pending-${pendingToPeer.id}`)) return prev;
          return [
            ...prev,
            {
              id: `pending-${pendingToPeer.id}`,
              kind: "sent" as const,
              text: `Challenge pending in ${pendingToPeer.categoryName}`,
              createdAt: pendingToPeer.createdAt || new Date().toISOString(),
            },
          ];
        });
      }
    };

    const onReceived = (ch: IncomingChallenge) => {
      if (!sameUserId(ch.from.userId, peerId)) return;
      peerChallengeIdsRef.current.add(ch.id);
      setIncomingChallenge(ch);
      setChallengeResponding(false);
      setChallengeSending(false);
    };

    const onSent = (ch: IncomingChallenge) => {
      if (!sameUserId(ch.to?.userId, peerId)) return;
      peerChallengeIdsRef.current.add(ch.id);
      setChallengeModalOpen(false);
      setChallengeSending(false);
      setChallengeLog((prev) => {
        const pendingId = `pending-${ch.id}`;
        const hasPending = prev.some((e) => e.id === pendingId);
        const withoutDupes = prev.filter(
          (e) => !(e.kind === "sent" && !e.id.startsWith("pending-") && e.text.includes(ch.categoryName))
        );
        const next = hasPending
          ? withoutDupes
          : [
              ...withoutDupes,
              {
                id: pendingId,
                kind: "sent" as const,
                text: `Challenge pending in ${ch.categoryName}`,
                createdAt: ch.createdAt || new Date().toISOString(),
              },
            ];
        return next;
      });
      toast.success("Challenge sent", { position: "top-center" });
    };

    const onCancelled = ({ challengeId }: { challengeId: string }) => {
      if (!peerChallengeIdsRef.current.has(challengeId)) return;
      setIncomingChallenge((prev) => (prev?.id === challengeId ? null : prev));
      setChallengeLog((prev) => prev.filter((e) => e.id !== `pending-${challengeId}`));
      appendChallengeLog({ kind: "cancelled", text: "Challenge was cancelled" });
    };

    const onResult = ({
      challengeId,
      status,
    }: {
      challengeId: string;
      status: "accepted" | "rejected";
    }) => {
      if (!peerChallengeIdsRef.current.has(challengeId)) return;
      setIncomingChallenge((prev) => (prev?.id === challengeId ? null : prev));
      setChallengeLog((prev) => prev.filter((e) => e.id !== `pending-${challengeId}`));
      if (status === "rejected") {
        appendChallengeLog({
          kind: "rejected",
          text: "Challenge declined",
        });
      } else {
        appendChallengeLog({
          kind: "accepted",
          text: `Challenge accepted — starting battle…`,
        });
      }
    };

    const onError = ({ message }: { message?: string }) => {
      appendChallengeLog({
        kind: "error",
        text: message || "Challenge failed",
      });
      toast.error(message || "Challenge failed", { position: "top-center" });
      setChallengeSending(false);
      setChallengeResponding(false);
    };

    const onMatchFound = (p: MatchFoundPayload) => {
      if (!sameUserId(p.opponent.userId, peerId)) return;
      setIncomingChallenge(null);
      navigate("/battle", {
        state: {
          mode: "online" as const,
          matchId: p.matchId,
          mySeat: p.mySeat,
          myUserId: p.myUserId,
          opponentUserId: p.opponent.userId,
          categoryId: p.categoryId,
          categoryName: p.categoryName,
          totalRounds: p.totalRounds,
          me: {
            userId: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            score: 0,
            answers: [],
            level: user.level,
          },
          opponent: {
            userId: p.opponent.userId,
            username: p.opponent.username,
            avatarUrl: p.opponent.avatarUrl,
            score: 0,
            answers: [],
            level: p.opponent.level,
          },
        },
      });
    };

    socket.emit("challenge:list");
    socket.on("challenge:list", onList);
    socket.on("challenge:received", onReceived);
    socket.on("challenge:sent", onSent);
    socket.on("challenge:cancelled", onCancelled);
    socket.on("challenge:result", onResult);
    socket.on("challenge:error", onError);
    socket.on("match_found", onMatchFound);

    return () => {
      socket.off("challenge:list", onList);
      socket.off("challenge:received", onReceived);
      socket.off("challenge:sent", onSent);
      socket.off("challenge:cancelled", onCancelled);
      socket.off("challenge:result", onResult);
      socket.off("challenge:error", onError);
      socket.off("match_found", onMatchFound);
    };
  }, [user?.id, user?.username, user?.avatarUrl, user?.level, peerId, navigate, appendChallengeLog]);

  // Auto-scroll: instant on first history load, smooth on every new message (sent or received)
  useEffect(() => {
    if (decryptedMessages.length === 0) return;

    if (!didInitialScrollRef.current) {
      // First batch of messages just arrived — wait one frame for layout to settle then snap to bottom
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
        didInitialScrollRef.current = true;
      }, 60);
      return () => clearTimeout(timer);
    } else {
      // A new message was sent or received — smooth scroll to it
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [decryptedMessages.length, challengeLog.length, incomingChallenge?.id]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !roomId) return;

    if (isE2eActive && sharedKey) {
      try {
        const payload = JSON.stringify({ text: trimmed });
        const encrypted = await encryptMessage(sharedKey, payload);
        chatService.sendMessage(roomId, encrypted);
      } catch (err) {
        console.error("E2E Encryption send failed, falling back to plaintext:", err);
        chatService.sendMessage(roomId, trimmed);
      }
    } else {
      chatService.sendMessage(roomId, trimmed);
    }

    setText("");
    inputRef.current?.focus();
  };

  const handleMediaPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaPreview({ url, type: file.type, file });
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
    clearMedia(false);

    try {
      const { mediaUrl, mediaType } = await chatService.uploadMedia(file);
      
      if (isE2eActive && sharedKey) {
        const payload = JSON.stringify({ text: "", mediaUrl, mediaType });
        const encrypted = await encryptMessage(sharedKey, payload);
        chatService.sendMessage(roomId, encrypted, "", "", localId);
      } else {
        chatService.sendMessage(roomId, "", mediaUrl, mediaType, localId);
      }
    } catch (error) {
      console.error("Media upload failed:", error);
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      URL.revokeObjectURL(objectUrl);
    }
  };

  const peerAvatar =
    resolveMediaUrl(peer?.avatarUrl) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(peerName)}`;

  const grouped = useMemo(() => groupMessages(decryptedMessages), [decryptedMessages]);

  const BRAND = "#128c7e"; // lighter warm-green

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
          className="shrink-0 focus:outline-none relative"
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
          {peerId && (
            <OnlineIndicator
              isOnline={isOnline(peerId)}
              className="absolute bottom-0 right-0 border-2 border-[#128c7e] rounded-full"
            />
          )}
        </button>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-[15px] truncate leading-tight">{peerName}</p>
          <p className="text-[11px] flex items-center gap-1 text-[#b2dfdb]">
            {isE2eActive ? (
              <>
                <Lock className="w-2.5 h-2.5 inline-block" />
                end-to-end encrypted
              </>
            ) : (
              <>tap to view profile</>
            )}
          </p>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-white">
          <button
            type="button"
            onClick={openChallengeModal}
            className="p-2 rounded-full active:bg-white/10"
            aria-label="Send challenge"
          >
            <Swords className="w-5 h-5" />
          </button>
          <button type="button" className="p-2 rounded-full active:bg-white/10">
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
        {/* E2E Status Banner */}
        <div
          className="mx-auto my-2 max-w-[280px] flex items-center gap-1.5 text-center text-[11px] px-3 py-1.5 rounded-full shadow-sm select-none"
          style={{
            background: isE2eActive ? "rgba(0,128,80,0.13)" : "rgba(100,100,100,0.13)",
            color: isE2eActive ? "#1a6640" : "#555",
            border: `1px solid ${isE2eActive ? "rgba(0,128,80,0.18)" : "rgba(100,100,100,0.15)"}`,
          }}
        >
          {isE2eActive ? (
            <Lock className="w-3 h-3 shrink-0" />
          ) : (
            <Unlock className="w-3 h-3 shrink-0" />
          )}
          <span>
            {cryptoError
              ? cryptoError
              : isE2eActive
              ? "Messages are end-to-end encrypted. No one outside this chat can read them."
              : peer && !peer.publicKeyE2e
              ? "Standard chat — peer hasn't enabled E2E encryption yet."
              : "Setting up secure channel…"}
          </span>
        </div>

        {/* Empty state — hide when challenge UI is showing */}
        {messages.length === 0 && !hasChallengeActivity && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center py-10">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-sm flex flex-col items-center gap-2 max-w-[220px]">
              <img src={peerAvatar} alt="" className="w-14 h-14 rounded-full border-2 border-white shadow" />
              <p className="text-[13px] text-[#111]/70 font-medium leading-snug">
                Say hi to <span style={{ color: BRAND }} className="font-bold">{peerName}</span>!<br />
                {isE2eActive ? (
                  <span className="text-[11px] font-normal" style={{ color: "#1a6640" }}>
                    🔒 End-to-end encrypted
                  </span>
                ) : (
                  <span className="text-[11px] font-normal text-[#111]/50">
                    Standard chat
                  </span>
                )}
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

        {/* Challenge activity (after messages so auto-scroll keeps it visible) */}
        {challengeLog.map((entry) => (
          <div key={entry.id} className="flex flex-col items-center gap-1">
            <ChallengeResultCard text={entry.text} variant={entry.kind} />
            {entry.kind === "sent" && entry.id.startsWith("pending-") && (
              <button
                type="button"
                onClick={() => cancelOutgoingChallenge(entry.id.replace("pending-", ""))}
                className="text-[11px] font-semibold text-[#128c7e] underline"
              >
                Cancel challenge
              </button>
            )}
          </div>
        ))}

        {incomingChallenge && (
          <IncomingChallengeCard
            challenge={incomingChallenge}
            peerName={peerName}
            responding={challengeResponding}
            onRespond={respondToChallenge}
          />
        )}

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
              type="button"
              onClick={() => clearMedia()}
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

      {/* Challenge category picker */}
      {challengeModalOpen && peerId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Challenge</p>
                <p className="text-[15px] font-bold text-slate-900 truncate mt-0.5">{peerName}</p>
              </div>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500"
                onClick={() => setChallengeModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
              {categoriesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              )}
              {categoriesError && !categoriesLoading && (
                <p className="text-sm font-medium text-red-600 py-4 text-center">{categoriesError}</p>
              )}
              {!categoriesLoading && !categoriesError && allCategories.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No topics available right now.</p>
              )}
              {!categoriesLoading &&
                allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={challengeSending}
                    onClick={() => sendChallengeForCategory(cat.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm text-left hover:border-[#128c7e] transition-colors disabled:opacity-60"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
                      <CategoryIcon
                        category={cat}
                        size={40}
                        style="fluency"
                        className="h-9 w-9 object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-slate-900 truncate">{cat.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {cat.questionCount} questions
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
