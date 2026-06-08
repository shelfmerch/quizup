import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getSocket } from "@/services/socketService";
import { API_URL } from "@/config/env";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MatchFoundPayload } from "@/types";
import ChallengeShareSheet from "@/components/ChallengeShareSheet";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface ChallengeDetail {
  id: string;
  from: { userId: string; username: string; avatarUrl: string };
  to: { userId: string; username: string };
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  shareUrl?: string;
  fromOnline?: boolean;
  toOnline?: boolean;
}

const ChallengeInvitePage: React.FC = () => {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { isOnline } = useOnlineStatus(challenge?.from.userId);

  const loadChallenge = useCallback(async () => {
    if (!challengeId || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("quizup_token");
      const res = await fetch(`${API_URL}/challenges/${challengeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Challenge not found");
      }
      setChallenge(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load challenge");
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [challengeId, user?.id]);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    if (!user?.id || !challengeId) return;
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onDetail = (ch: ChallengeDetail) => {
      if (ch.id === challengeId) setChallenge(ch);
    };
    const onError = ({ message }: { message?: string }) => {
      if (message) toast.error(message, { position: "top-center" });
      setResponding(false);
    };
    const onMatchFound = (p: MatchFoundPayload) => {
      setResponding(false);
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

    socket.on("challenge:detail", onDetail);
    socket.on("challenge:error", onError);
    socket.on("match_found", onMatchFound);
    socket.emit("challenge:get", { challengeId });

    return () => {
      socket.off("challenge:detail", onDetail);
      socket.off("challenge:error", onError);
      socket.off("match_found", onMatchFound);
    };
  }, [challengeId, navigate, user?.avatarUrl, user?.id, user?.level, user?.username]);

  const respond = (action: "accept" | "reject") => {
    if (!challenge || responding) return;
    setResponding(true);
    try {
      getSocket().emit("challenge:respond", { challengeId: challenge.id, action });
      if (action === "reject") {
        toast.success("Challenge declined", { position: "top-center" });
        navigate(-1);
        setResponding(false);
      }
    } catch {
      setResponding(false);
    }
  };

  const isSender = challenge?.from.userId === user?.id;
  const isReceiver = challenge?.to.userId === user?.id;
  const challengerOnline = challenge?.fromOnline ?? isOnline(challenge?.from.userId ?? "");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <p className="text-sm font-bold text-slate-600">{error || "Challenge not found"}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-4 h-10 px-5 rounded-lg bg-[#f65357] text-sm font-black text-white"
        >
          Go home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="quizup-topbar">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-[17px] font-black">Challenge</h1>
        <div className="w-5" />
      </div>

      <div className="mx-4 mt-6 rounded-3xl bg-white border border-slate-200 shadow-lg overflow-hidden">
        <div className="px-6 py-8 text-center bg-gradient-to-br from-[#f65357]/10 to-[#0dbf9d]/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md mb-4">
            <CategoryIcon
              category={{
                id: challenge.categoryId,
                name: challenge.categoryName,
                icon: challenge.categoryIcon || "🎯",
                color: "0 0% 50%",
                questionCount: 0,
                description: "",
              }}
              size={48}
              style="fluency"
              className="h-12 w-12 object-contain"
            />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quiz battle</p>
          <h2 className="text-2xl font-black text-slate-900 mt-1">{challenge.categoryName}</h2>
          <p className="text-sm text-slate-600 font-medium mt-3">
            <span className="font-black text-slate-800">{challenge.from.username}</span>
            {" → "}
            <span className="font-black text-slate-800">{challenge.to.username}</span>
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!challengerOnline && (
            <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 leading-snug">
              {challenge.from.username} is offline. The match can only start when both players are active in the app.
            </p>
          )}

          {isReceiver && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={responding || !challengerOnline}
                onClick={() => respond("reject")}
                className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={responding || !challengerOnline}
                onClick={() => respond("accept")}
                className="h-12 rounded-xl bg-[#080808] text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                {responding ? "Starting…" : "Accept"}
              </button>
            </div>
          )}

          {isSender && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 font-medium text-center leading-snug">
                Waiting for {challenge.to.username} to accept. Share the link on WhatsApp or Instagram so they can join.
              </p>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="w-full h-12 rounded-xl bg-[#25D366] text-sm font-black text-white"
              >
                Share challenge
              </button>
            </div>
          )}

          {!isSender && !isReceiver && (
            <p className="text-sm text-slate-500 text-center">This challenge is not for your account.</p>
          )}
        </div>
      </div>

      {shareOpen && (
        <ChallengeShareSheet
          info={{
            challengeId: challenge.id,
            fromUsername: challenge.from.username,
            toUsername: challenge.to.username,
            categoryName: challenge.categoryName,
            shareUrl: challenge.shareUrl,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
};

export default ChallengeInvitePage;
