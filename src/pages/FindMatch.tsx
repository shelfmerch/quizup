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

    <div className="min-h-screen flex flex-col max-w-md mx-auto">
      <div className="quizup-header-red px-4 py-3 text-center shadow-md">
        <h1 className="font-display font-bold text-white text-base tracking-tight">{topicMeta.name}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-32 h-32 rounded-full bg-white shadow-xl flex items-center justify-center text-6xl mb-8 border border-slate-100">
          <span className="drop-shadow-lg">{topicMeta.icon}</span>
        </div>

        {error ? (
          <div className="text-center w-full glass-card p-6 rounded-3xl border-red-100">
            <p className="text-red-500 font-bold mb-2">{error}</p>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed">
              Ensure the game server is reachable and you are logged in correctly.
            </p>
            <button type="button" onClick={() => navigate(-1)} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
              Go back
            </button>
          </div>
        ) : !found ? (
          <>
            <p className="text-slate-900 font-display font-black text-2xl mb-2 tracking-tight">Finding Opponent</p>
            <p className="text-slate-400 text-sm mb-12 text-center font-medium">Searching the live matchmaking queue...</p>

            <div className="relative w-24 h-24 mb-12">
              {[0, 0.5, 1].map((delay) => (
                <motion.div
                  key={delay}
                  animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay }}
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: "hsl(var(--quizup-red))" }}
                />
              ))}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center shadow-inner"
                style={{ backgroundColor: "hsl(var(--quizup-red) / 0.1)" }}
              >
                <div className="w-5 h-5 rounded-full btn-gradient-red animate-pulse" />
              </div>
            </div>

            <button type="button" onClick={() => navigate(-1)} className="px-8 py-3 rounded-full border border-slate-200 text-sm font-bold text-slate-400 hover:bg-white hover:text-slate-600 transition-all shadow-sm">
              Cancel Search
            </button>
          </>
        ) : (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center w-full">
            <div className="glass-card p-8 rounded-[2.5rem] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500" />
              <p className="text-emerald-600 font-display font-black text-2xl mb-8 tracking-tight">MATCH FOUND!</p>
              
              <div className="flex items-center justify-center gap-4">
                <div className="flex-1 flex flex-col items-center gap-3">
                  <div className="relative">
                    <img
                      src={user?.avatarUrl}
                      alt=""
                      className="w-20 h-20 rounded-full border-4 border-white shadow-xl object-cover"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                      {user?.level}
                    </div>
                  </div>
                  <p className="text-sm text-slate-900 font-black truncate max-w-[80px]">{user?.username}</p>
                </div>

                <div className="px-4">
                   <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                     <span className="text-lg font-display font-black text-slate-400">VS</span>
                   </div>
                </div>

                <div className="flex-1 flex flex-col items-center gap-3">
                  <div className="relative">
                    <img
                      src={payload?.opponent.avatarUrl}
                      alt=""
                      className="w-20 h-20 rounded-full border-4 border-white shadow-xl object-cover"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                      {payload?.opponent.level}
                    </div>
                  </div>
                  <p className="text-sm text-slate-900 font-black truncate max-w-[80px]">{payload?.opponent.username}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default FindMatch;
