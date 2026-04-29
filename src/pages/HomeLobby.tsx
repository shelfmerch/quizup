import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { profileService } from "@/services/profileService";
import { MatchFoundPayload, MatchHistoryEntry } from "@/types";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import {
  fetchFollowedCategories,
  fetchPublicCategories,
} from "@/services/categoryService";
import { Category } from "@/types";
import { fetchChatUnreadSummary, type ChatUnreadItem } from "@/services/chatApi";
import { subscribeChatInbox } from "@/services/chatService";
import { leaderboardService } from "@/services/leaderboardService";
import { LeaderboardEntry } from "@/types";
import { resolveMediaUrl } from "@/config/env";
import { Search, ChevronRight, ChevronDown, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket } from "@/services/socketService";
import Icons8Icon, { getCategoryIconSlug } from "@/components/Icons8Icon";


const CATEGORY_THEMES = [
  { bg: "quizup-header-red", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-green", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-teal", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-blue", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-purple", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-orange", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "bg-white", text: "text-black", textMuted: "text-black/60", icon: "text-black/40" },
];

const POPULAR_COUNT = 9;

type ChallengeWire = {
  id: string;
  from: { userId: string; username: string; avatarUrl?: string };
  to: { userId: string; username: string };
  categoryId: string;
  categoryName: string;
  createdAt: string;
};

function mergeAllTopics(apiList: Category[]): Category[] {
  const byId = new Map<string, Category>();
  apiList.forEach((c) => byId.set(c.id, c));
  EXTRA_HOME_TOPICS.forEach((c) => {
    if (!byId.has(c.id)) byId.set(c.id, c);
  });
  if (byId.size === 0) {
    MOCK_CATEGORIES.forEach((c) => byId.set(c.id, c));
  }
  return Array.from(byId.values());
}

const HomeLobby: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = !!user?.id;
  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [followedTopics, setFollowedTopics] = useState<Category[]>([]);
  const [followedLoaded, setFollowedLoaded] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  const [chatUnreadOpen, setChatUnreadOpen] = useState(false);
  const [chatUnreadItems, setChatUnreadItems] = useState<ChatUnreadItem[]>([]);
  const [chatTotalUnread, setChatTotalUnread] = useState(0);
  const chatDropdownRef = useRef<HTMLDivElement>(null);

  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeWire[]>([]);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [followingUsers, setFollowingUsers] = useState<{ id: string; username: string; displayName: string; avatarUrl: string; level: number; country: string }[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardService.getGlobalLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { setFollowingUsers([]); return; }
    let cancelled = false;
    setFollowingLoading(true);
    profileService.getFollowingUsers().then((list) => {
      if (!cancelled) setFollowingUsers(list);
    }).catch(() => {
      if (!cancelled) setFollowingUsers([]);
    }).finally(() => {
      if (!cancelled) setFollowingLoading(false);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const loadChatUnread = useCallback(async () => {
    try {
      const data = await fetchChatUnreadSummary();
      setChatUnreadItems(data.items);
      setChatTotalUnread(data.totalUnread);
    } catch {
      setChatUnreadItems([]);
      setChatTotalUnread(0);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const goToBattleFromMatchFound = useCallback(
    (p: MatchFoundPayload) => {
      if (!user?.id) return;
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
    },
    [navigate, user?.avatarUrl, user?.id, user?.level, user?.username]
  );

  useEffect(() => {
    if (!user?.id) return;
    loadChatUnread();
  }, [user?.id, loadChatUnread]);

  // ─── Challenges (Socket.io) ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setIncomingChallenges([]);
      setChallengeError(null);
      return;
    }

    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onList = (payload: { incoming?: ChallengeWire[]; outgoing?: ChallengeWire[] }) => {
      setIncomingChallenges(payload?.incoming || []);
    };

    const onReceived = (ch: ChallengeWire) => {
      setIncomingChallenges((prev) => {
        if (prev.some((x) => x.id === ch.id)) return prev;
        return [ch, ...prev];
      });
    };

    const onSent = (ch: ChallengeWire) => {
      // Lobby does not render outgoing challenges, but keep list fresh for future sections if needed.
      void ch;
    };

    const onCancelled = (payload: { challengeId: string }) => {
      const id = payload?.challengeId;
      if (!id) return;
      setIncomingChallenges((prev) => prev.filter((x) => x.id !== id));
    };

    const onResult = (payload: { challengeId: string; status: "accepted" | "rejected"; matchId?: string }) => {
      const id = payload?.challengeId;
      if (!id) return;
      setIncomingChallenges((prev) => prev.filter((x) => x.id !== id));
    };

    const onChallengeError = (payload: { message?: string }) => {
      setChallengeError(payload?.message || "Challenge error");
    };

    const onMatchFound = (p: MatchFoundPayload) => {
      goToBattleFromMatchFound(p);
    };

    socket.on("challenge:list", onList);
    socket.on("challenge:received", onReceived);
    socket.on("challenge:sent", onSent);
    socket.on("challenge:cancelled", onCancelled);
    socket.on("challenge:result", onResult);
    socket.on("challenge:error", onChallengeError);
    socket.on("match_found", onMatchFound);

    socket.emit("challenge:list");

    return () => {
      if (!socket) return;
      socket.off("challenge:list", onList);
      socket.off("challenge:received", onReceived);
      socket.off("challenge:sent", onSent);
      socket.off("challenge:cancelled", onCancelled);
      socket.off("challenge:result", onResult);
      socket.off("challenge:error", onChallengeError);
      socket.off("match_found", onMatchFound);
    };
  }, [goToBattleFromMatchFound, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeChatInbox(() => {
      loadChatUnread();
    });
  }, [user?.id, loadChatUnread]);

  useEffect(() => {
    if (!chatUnreadOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = chatDropdownRef.current;
      if (el && !el.contains(e.target as Node)) setChatUnreadOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [chatUnreadOpen]);

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => loadChatUnread();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, loadChatUnread]);

  useEffect(() => {
    if (!user?.id) {
      setRecentMatches([]);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(false);
    profileService
      .getMatchHistory(user.id, 10)
      .then((rows) => {
        if (!cancelled) setRecentMatches(rows.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryError(true);
          setRecentMatches([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCategories()
      .then((list) => {
        if (!cancelled) setApiCategories(list);
      })
      .catch(() => {
        if (!cancelled) setApiCategories([]);
      })
      .finally(() => {
        if (!cancelled) setTopicsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setFollowedTopics([]);
      setFollowedLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    setFollowedLoaded(false);
    fetchFollowedCategories()
      .then((list) => {
        if (!cancelled) setFollowedTopics(list);
      })
      .catch(() => {
        if (!cancelled) setFollowedTopics([]);
      })
      .finally(() => {
        if (!cancelled) setFollowedLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const allTopics = useMemo(() => mergeAllTopics(apiCategories), [apiCategories]);

  const popularTopics = useMemo(() => {
    return [...allTopics].sort((a, b) => b.questionCount - a.questionCount).slice(0, POPULAR_COUNT);
  }, [allTopics]);

  const moreTopics = useMemo(() => {
    const ids = new Set(popularTopics.map((c) => c.id));
    return allTopics.filter((c) => !ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTopics, popularTopics]);

  const renderTopicRow = (cat: Category, colorIndex: number) => {
    const theme = CATEGORY_THEMES[colorIndex % CATEGORY_THEMES.length];
    const { slug, fallback } = getCategoryIconSlug(cat.name);
    return (
      <div className="mx-1">
        <motion.button
          key={cat.id}
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(`/category/${cat.id}`)}
          className={`${theme.bg} rounded-2xl aspect-square w-full flex items-center justify-center p-2 shadow-md relative overflow-hidden`}
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
        >
          {/* subtle shimmer layer */}
          <div className="absolute inset-0 bg-white/10 rounded-2xl" />
          <Icons8Icon
            name={slug}
            fallback={fallback}
            size={80}
            style="animated-fluency"
            className="relative z-10 w-20 h-20 object-contain drop-shadow-sm"
            alt={cat.name}
          />
        </motion.button>
        <div className="flex-1 min-w-0 mt-1">
          <p className={`font-display text-xs font-semibold text-slate-800 text-center leading-tight`}>{cat.name}</p>
          <p className={`text-[9px] text-slate-400 text-center`}>{cat.questionCount} Qs</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <img
            src={resolveMediaUrl(
              user?.avatarUrl,
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username || "user")}`
            )}
            alt="avatar"
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full border-2 border-slate-200 object-cover cursor-pointer"
          />
          <span className="font-display font-bold text-slate-900 text-sm">{user?.username || "Player"}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button">
            <Search className="w-5 h-5 text-slate-500" />
          </button>
          <div className="relative" ref={chatDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setChatUnreadOpen((o) => !o);
                loadChatUnread();
              }}
              className="relative p-0.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Chat notifications"
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {chatTotalUnread > 0 && (
                <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-white">
                  {chatTotalUnread > 99 ? "99+" : chatTotalUnread}
                </span>
              )}
            </button>
            {chatUnreadOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,18rem)] max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl z-[100] py-1">
                {chatUnreadItems.length === 0 ? (
                  <p className="text-xs text-slate-400 px-4 py-8 text-center">No unread messages</p>
                ) : (
                  chatUnreadItems.map((item) => (
                    <button
                      key={item.peerId}
                      type="button"
                      onClick={() => {
                        navigate(`/chat/${item.peerId}`);
                        setChatUnreadOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors"
                    >
                      <img
                        src={resolveMediaUrl(
                          item.avatarUrl,
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.username)}`
                        )}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {item.displayName || item.username}
                        </p>
                        <p className="text-[10px] text-slate-400">Direct message</p>
                      </div>
                      <span className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate("/categories")}
        className="mx-4 mt-6 h-28 rounded-3xl btn-gradient-purple relative overflow-hidden flex items-center px-6"
      >
        <div className="absolute top-0 right-0 w-48 h-full bg-white/10 -skew-x-12 translate-x-24" />
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        />
        <div className="relative z-10">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Ready to play?</p>
          <p className="text-white text-2xl font-display font-extrabold">Find a Match</p>
          <p className="text-white/80 text-xs mt-1">Challenge someone in real-time trivia</p>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Icons8Icon
            name="lightning-bolt"
            fallback="⚡"
            size={96}
            style="animated-fluency"
            className="w-20 h-20 opacity-90 drop-shadow-lg"
            alt=""
          />
        </div>
      </motion.button>

      <div className="bg-white/60 backdrop-blur border-b border-slate-100">
        <div className="flex items-center divide-x divide-slate-100">
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Your Level</p>
            <p className="text-xl font-display font-extrabold text-slate-900">{user?.level || 1}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Wins</p>
            <p className="text-xl font-display font-extrabold text-slate-900">{user?.wins || 0}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Win Streak</p>
            <p className="text-xl font-display font-extrabold text-slate-900">{user?.winStreak || 0}🔥</p>
          </div>
        </div>
      </div>


      <div className="px-4 pb-24 ">
        {(isAuthenticated || incomingChallenges.length > 0) && (
          <div className="mt-6 mb-4 rounded-3xl glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-purple-500 rounded-full" />
                <h2 className="font-display font-bold text-slate-800 text-sm uppercase tracking-wider">Challenges</h2>
              </div>
              {incomingChallenges.length > 0 && (
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {incomingChallenges.length} incoming
                  </p>
                  <button onClick={() => navigate('/leaderboard')} className="text-white btn-gradient-green rounded-2xl px-4 py-1.5 text-xs font-bold shadow-sm">SEND</button>
                </div>
              )}
            </div>

            {!isAuthenticated ? (
              <p className="text-zinc-500 text-sm">Sign in to send and receive challenges.</p>
            ) : (
              <>
                {challengeError && <p className="text-xs text-quizup-red mb-2">{challengeError}</p>}

                {incomingChallenges.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {incomingChallenges.map((ch) => (
                      <div key={ch.id} className="rounded-xl border border-slate-50 bg-slate-50/50 p-3 flex items-center gap-3">
                        <img
                          src={resolveMediaUrl(
                            ch.from.avatarUrl,
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(ch.from.username)}`
                          )}
                          alt=""
                          className="w-10 h-10 rounded-full border border-slate-200 object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{ch.from.username} challenged you</p>
                          <p className="text-[10px] text-slate-400 truncate">{ch.categoryName}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                getSocket().emit("challenge:respond", { challengeId: ch.id, action: "reject" });
                              } catch { }
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-100"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                getSocket().emit("challenge:respond", { challengeId: ch.id, action: "accept" });
                              } catch { }
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold quizup-header-green text-white"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <hr className="border-slate-200 my-4" />

         <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-blue-500 rounded-full" />
                <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wider">
                  People
                </h3>
              </div>
              {!isAuthenticated ? (
                <p className="text-slate-400 text-sm">Sign in to see people you follow.</p>
              ) : followingLoading ? (
                <p className="text-slate-400 text-sm">Loading people…</p>
              ) : followingUsers.length === 0 ? (
                <p className="text-slate-400 text-sm">Follow some players to see them here.</p>
              ) : (
                <div className="flex flex-row gap-4 overflow-x-auto pb-1">
                  {entries.slice(0,5).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => navigate(`/profile/${u.id}`)}
                      className="flex flex-col items-center gap-1.5 shrink-0"
                    >
                      <div
                        className="w-14 h-14 rounded-full border-2 overflow-hidden shadow-sm"
                        style={{ borderColor: "hsl(270 60% 50%)" }}
                      >
                        <img
                          src={resolveMediaUrl(
                            u.avatarUrl,
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username)}`
                          )}
                          alt={u.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[56px] text-center">{u.displayName || u.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

        <hr className="border-slate-200 my-4" /> 

        <div className="flex items-center gap-2 mb-4 mt-8">
          <div className="w-1 h-5 bg-orange-500 rounded-full" />
          <h2 className="font-display font-bold text-slate-800 text-sm uppercase tracking-wider">Popular Topics</h2>
        </div>
        {!topicsLoaded ? (
          <p className="text-slate-400 text-sm py-4">Loading topics…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">{popularTopics.map((cat, i) => renderTopicRow(cat, i))}</div>

          <hr className="border-slate-200 my-4" /> 

            <div className="mt-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-teal-500 rounded-full" />
                <h3 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Followed Topics
                </h3>
              </div>
              {!isAuthenticated ? (
                <p className="text-slate-400 text-sm">Sign in to see your followed topics.</p>
              ) : !followedLoaded ? (
                <p className="text-slate-400 text-sm">Loading followed topics…</p>
              ) : followedTopics.length === 0 ? (
                <p className="text-slate-400 text-sm">You haven't followed any topics yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {followedTopics.slice(0, 3).map((cat, i) => renderTopicRow(cat, i))}
                </div>
              )}
            </div>
 
            <hr className="border-slate-200 my-4" /> 

           
            </>
        )}
        </div>

        {/* <div className="bg-gray-300/50 p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-zinc-800 text-sm uppercase tracking-wider">Recent Matches</h2>
            <button
              type="button"
              onClick={() => navigate("/history")}
              className="text-xs text-quizup-green font-semibold flex items-center gap-0.5"
            >
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 mb-6">
            {historyLoading ? (
              <>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-zinc-900 rounded-xl p-3 h-[72px] border border-zinc-800 animate-pulse" />
                ))}
              </>
            ) : historyError ? (
              <p className="text-zinc-500 text-sm py-2">Couldn&apos;t load recent matches.</p>
            ) : recentMatches.length === 0 ? (
              <p className="text-zinc-500 text-sm py-2">No completed matches yet. Play a battle to see history here.</p>
            ) : (
              recentMatches.map((match) => (
                <div key={match.matchId} className="bg-zinc-900 rounded-xl p-3 flex items-center gap-3 border border-zinc-800">
                  <img
                    src={match.opponentAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=opponent"}
                    alt=""
                    className="w-10 h-10 rounded-full bg-zinc-800"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{match.opponentName}</p>
                    <p className="text-[10px] text-zinc-500">{match.categoryName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-display font-bold text-white">
                      {match.playerScore} - {match.opponentScore}
                    </p>
                    <p
                      className={`text-[10px] font-bold uppercase ${match.result === "win"
                        ? "text-quizup-green"
                        : match.result === "loss"
                          ? "text-quizup-red"
                          : "text-quizup-gold"
                        }`}
                    >
                      {match.result}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div> */}

      </div>
      );
};

      export default HomeLobby;
