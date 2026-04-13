import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MatchFoundPayload } from "@/types";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { fetchPublicCategories } from "@/services/categoryService";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { getSocket } from "@/services/socketService";
import { API_BASE } from "@/config/env";

const FindMatch: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [found, setFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<MatchFoundPayload | null>(null);

  const [topicMeta, setTopicMeta] = useState(() => {
    const mock = MOCK_CATEGORIES.find((c) => c.id === categoryId);
    return {
      name: mock?.name || (categoryId ? categoryId.replace(/-/g, " ") : "Quiz"),
      icon: mock?.icon || "🎯",
    };
  });

  useEffect(() => {
    const mock = MOCK_CATEGORIES.find((c) => c.id === categoryId);
    if (mock) {
      setTopicMeta({ name: mock.name, icon: mock.icon });
      return;
    }
    let cancelled = false;
    fetchPublicCategories()
      .then((list) => {
        const c = list.find((x) => x.id === categoryId);
        if (!cancelled && c) setTopicMeta({ name: c.name, icon: c.icon });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    const cat = categoryId || "science";
    let cancelled = false;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect");
      return;
    }

    const onQueued = () => {
      setError(null);
    };

    const onMatchFound = (p: MatchFoundPayload) => {
      if (cancelled) return;
      setPayload(p);
      setFound(true);
      setTimeout(() => {
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
      }, 1500);
    };

    const onQueueError = (e: { message?: string }) => {
      setError(e.message || "Queue error");
    };

    const onConnectError = (err: Error) => {
      setError(err.message || "Could not reach game server");
    };

    socket.on("queued", onQueued);
    socket.on("match_found", onMatchFound);
    socket.on("queue_error", onQueueError);
    socket.on("connect_error", onConnectError);

    socket.emit("join_queue", { categoryId: cat });

    return () => {
      cancelled = true;
      socket.emit("leave_queue", { categoryId: cat });
      socket.off("queued", onQueued);
      socket.off("match_found", onMatchFound);
      socket.off("queue_error", onQueueError);
      socket.off("connect_error", onConnectError);
    };
  }, [categoryId, isAuthenticated, isLoading, navigate, user]);

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-quizup-dark flex flex-col items-center justify-center max-w-md mx-auto px-6">
        <p className="text-foreground text-center mb-4">Log in to find a real opponent.</p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full h-12 rounded-lg quizup-header-green text-foreground font-display font-bold"
        >
          GO TO LOGIN
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-quizup-dark flex flex-col max-w-md mx-auto">
      <div className="quizup-header-red px-4 py-3 text-center">
        <h1 className="font-display font-bold text-foreground text-base">{topicMeta.name}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <span className="text-6xl mb-4">{topicMeta.icon}</span>

        {error ? (
          <div className="text-center w-full">
            <p className="text-quizup-red font-semibold mb-2">{error}</p>
            <p className="text-muted-foreground text-sm mb-6">
              Ensure the API is running ({API_BASE}) and you are logged in with two different accounts in two browsers.
            </p>
            <button type="button" onClick={() => navigate(-1)} className="text-sm text-muted-foreground">
              Go back
            </button>
          </div>
        ) : !found ? (
          <>
            <p className="text-foreground font-display font-bold text-lg mb-2">Finding Opponent...</p>
            <p className="text-muted-foreground text-sm mb-8 text-center">Waiting in the live matchmaking queue</p>

            <div className="relative w-20 h-20 mb-8">
              {[0, 0.5, 1].map((delay) => (
                <motion.div
                  key={delay}
                  animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay }}
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: "hsl(4 78% 55%)" }}
                />
              ))}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "hsl(4 78% 55% / 0.3)" }}
              >
                <div className="w-4 h-4 rounded-full quizup-answer-red animate-pulse" />
              </div>
            </div>

            <button type="button" onClick={() => navigate(-1)} className="text-sm text-muted-foreground">
              Cancel
            </button>
          </>
        ) : (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
            <p className="text-quizup-green font-display font-extrabold text-xl mb-4">OPPONENT FOUND!</p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <img
                  src={user?.avatarUrl}
                  alt=""
                  className="w-16 h-16 rounded-full border-2 mx-auto mb-1"
                  style={{ borderColor: "hsl(152 69% 42%)" }}
                />
                <p className="text-xs text-foreground font-semibold">{user?.username}</p>
                <p className="text-[10px] text-muted-foreground">Lvl {user?.level}</p>
              </div>
              <span className="text-2xl font-display font-extrabold text-quizup-gold">VS</span>
              <div className="text-center">
                <img
                  src={payload?.opponent.avatarUrl}
                  alt=""
                  className="w-16 h-16 rounded-full border-2 mx-auto mb-1"
                  style={{ borderColor: "hsl(4 78% 55%)" }}
                />
                <p className="text-xs text-foreground font-semibold">{payload?.opponent.username}</p>
                <p className="text-[10px] text-muted-foreground">Lvl {payload?.opponent.level}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default FindMatch;
