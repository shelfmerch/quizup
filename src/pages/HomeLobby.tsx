import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { profileService } from "@/services/profileService";
import { MatchHistoryEntry } from "@/types";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import {
  fetchFollowedCategories,
  fetchPublicCategories,
  followCategory,
  unfollowCategory,
} from "@/services/categoryService";
import { Category } from "@/types";
import { fetchChatUnreadSummary, type ChatUnreadItem } from "@/services/chatApi";
import { subscribeChatInbox } from "@/services/chatService";
import { resolveMediaUrl } from "@/config/env";
import { Search, Settings, ChevronRight, ChevronDown, Bell, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORY_THEMES = [
  { bg: "quizup-header-red", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-green", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-teal", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-blue", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-purple", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "quizup-header-orange", text: "text-foreground", textMuted: "text-foreground/60", icon: "text-foreground/40" },
  { bg: "bg-white", text: "text-black", textMuted: "text-black/60", icon: "text-black/40" },
];

const POPULAR_COUNT = 6;

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
  const [followedBusy, setFollowedBusy] = useState<Record<string, boolean>>({});
  const [exploreOpen, setExploreOpen] = useState(false);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  const [chatUnreadOpen, setChatUnreadOpen] = useState(false);
  const [chatUnreadItems, setChatUnreadItems] = useState<ChatUnreadItem[]>([]);
  const [chatTotalUnread, setChatTotalUnread] = useState(0);
  const chatDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!user?.id) return;
    loadChatUnread();
  }, [user?.id, loadChatUnread]);

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
    const isFollowed = followedTopics.some((c) => c.id === cat.id);
    const isBusy = !!followedBusy[cat.id];
    return (
      <div className="mx-4">
      <motion.button
        key={cat.id}
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/category/${cat.id}`)}
        className={`${theme.bg} rounded-lg aspect-square w-full relative flex items-center justify-center p-2`}
      >
        <span className="text-6xl leading-none">{cat.icon}</span>

        {isAuthenticated ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setFollowedBusy((m) => ({ ...m, [cat.id]: true }));
              try {
                if (isFollowed) {
                  await unfollowCategory(cat.id);
                  setFollowedTopics((prev) => prev.filter((c) => c.id !== cat.id));
                } else {
                  await followCategory(cat.id);
                  setFollowedTopics((prev) => [{ ...cat }, ...prev]);
                }
              } finally {
                setFollowedBusy((m) => ({ ...m, [cat.id]: false }));
              }
            }}
            className={`absolute top-1 right-1 rounded-md p-1 transition-opacity ${
              isBusy ? "opacity-50" : "opacity-90 hover:opacity-100"
            } ${isFollowed ? "bg-black/20" : "bg-black/10"}`}
            aria-label={isFollowed ? "Unfollow topic" : "Follow topic"}
            title={isFollowed ? "Unfollow" : "Follow"}
          >
            <Star className={`w-4 h-4 ${isFollowed ? "text-yellow-300 fill-yellow-300" : "text-white/80"}`} />
          </button>
        ) : null}
        {/* <div className="flex-1 min-w-0">
          <p className={`font-display font-bold ${theme.text} text-sm`}>{cat.name}</p>
          <p className={`${theme.textMuted} text-[10px]`}>{cat.questionCount} questions</p>
        </div>
        <ChevronRight className={`w-5 h-5 ${theme.icon} shrink-0`} /> */}
      </motion.button>
      <div className="flex-1 min-w-0">
          <p className={`font-display font-bold ${theme.text} text-sm text-zinc-900 text-center`}>{cat.name}</p>
          <p className={`${theme.textMuted} text-[10px] text-zinc-900/50 text-center`}>{cat.questionCount} questions</p>
      </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fcf7f7]">
      <div className="quizup-header-gray px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={resolveMediaUrl(
              user?.avatarUrl,
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username || "user")}`
            )}
            alt="avatar"
            onClick={()=>navigate('/profile')}
            className="w-10 h-10 rounded-full border-2 border-foreground/30 object-cover"
          />
          <span className="font-display font-bold text-foreground text-sm">{user?.username || "Player"}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button">
            <Search className="w-5 h-5 text-foreground/80" />
          </button>
          <div className="relative" ref={chatDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setChatUnreadOpen((o) => !o);
                loadChatUnread();
              }}
              className="relative p-0.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Chat notifications"
            >
              <Bell className="w-5 h-5 text-foreground/80" />
              {chatTotalUnread > 0 && (
                <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none border border-[#121212]">
                  {chatTotalUnread > 99 ? "99+" : chatTotalUnread}
                </span>
              )}
            </button>
            {chatUnreadOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,18rem)] max-h-80 overflow-y-auto rounded-xl border border-zinc-700/90 bg-zinc-900 shadow-2xl z-[100] py-1">
                {chatUnreadItems.length === 0 ? (
                  <p className="text-xs text-zinc-500 px-4 py-8 text-center">No unread messages</p>
                ) : (
                  chatUnreadItems.map((item) => (
                    <button
                      key={item.peerId}
                      type="button"
                      onClick={() => {
                        navigate(`/chat/${item.peerId}`);
                        setChatUnreadOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left transition-colors"
                    >
                      <img
                        src={resolveMediaUrl(
                          item.avatarUrl,
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.username)}`
                        )}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-zinc-600 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {item.displayName || item.username}
                        </p>
                        <p className="text-[10px] text-zinc-500">Direct message</p>
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
          {/* <button type="button" onClick={() => navigate("/settings")}>
            <Settings className="w-5 h-5 text-foreground/80" />
          </button> */}
        </div>
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate("/categories")}
        className="w-full quizup-header-red p-6 text-left relative overflow-hidden"
      >
        <div className="relative z-10">
          <p className="text-foreground/60 text-xs font-semibold uppercase tracking-wider mb-1">Ready to play?</p>
          <p className="text-foreground text-2xl font-display font-extrabold">Find a Match</p>
          <p className="text-foreground/70 text-xs mt-1">Challenge someone in real-time trivia</p>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-80">
          <span className="text-7xl">⚡</span>
        </div>
      </motion.button>

      <div className="bg-zinc-900/80 border-b border-zinc-900/50">
        <div className="flex items-center divide-x divide-zinc-800">
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-zinc-300 uppercase tracking-wider">Your Level</p>
            <p className="text-xl font-display font-extrabold text-white">{user?.level || 1}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-zinc-300 uppercase tracking-wider">Wins</p>
            <p className="text-xl font-display font-extrabold text-white">{user?.wins || 0}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-zinc-300 uppercase tracking-wider">Win Streak</p>
            <p className="text-xl font-display font-extrabold text-white">{user?.winStreak || 0}🔥</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 bg-gray-300/50 p-3">
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
                    className={`text-[10px] font-bold uppercase ${
                      match.result === "win"
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
      </div>

      <div className="px-4 pb-24 ">
        <h2 className="font-display font-bold text-zinc-800 text-sm uppercase tracking-wider mb-3 mt-3">Popular Topics</h2>
        {!topicsLoaded ? (
          <p className="text-zinc-500 text-sm py-4">Loading topics…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">{popularTopics.map((cat, i) => renderTopicRow(cat, i))}</div>

            <div className="mt-6">
              <h3 className="font-display font-bold text-zinc-800 text-xs uppercase tracking-wider mb-3">
                Followed Topics
              </h3>
              {!isAuthenticated ? (
                <p className="text-zinc-500 text-sm">Sign in to follow topics.</p>
              ) : !followedLoaded ? (
                <p className="text-zinc-500 text-sm">Loading followed topics…</p>
              ) : followedTopics.length === 0 ? (
                <p className="text-zinc-500 text-sm">You haven't followed any topics yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">{followedTopics.map((cat, i) => renderTopicRow(cat, i))}</div>
              )}
            </div>

            {moreTopics.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  // onClick={() => setExploreOpen((o) => !o)}
                  onClick={() => navigate("/categories")}
                  className="flex items-center justify-center gap-1 w-full py-3 text-sm font-semibold text-quizup-green"
                >
                  Explore more topics
                  {exploreOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <AnimatePresence initial={false}>
                  {exploreOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pt-2 border-t border-zinc-800 mt-2">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">All other topics</p>
                        {moreTopics.map((cat, i) => renderTopicRow(cat, i + popularTopics.length))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* <button
                  type="button"
                  onClick={() => navigate("/categories")}
                  className="w-full mt-3 py-2 text-xs text-zinc-500 hover:text-zinc-400"
                >
                  Open full topics list
                </button> */}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HomeLobby;
