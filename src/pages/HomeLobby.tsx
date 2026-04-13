import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { profileService } from "@/services/profileService";
import { MatchHistoryEntry } from "@/types";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import { fetchPublicCategories } from "@/services/categoryService";
import { Category } from "@/types";
import { Search, Settings, ChevronRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORY_COLORS = [
  "quizup-header-red",
  "quizup-header-green",
  "quizup-header-teal",
  "quizup-header-blue",
  "quizup-header-purple",
  "quizup-header-orange",
];

const POPULAR_COUNT = 5;

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
  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

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

  const allTopics = useMemo(() => mergeAllTopics(apiCategories), [apiCategories]);

  const popularTopics = useMemo(() => {
    return [...allTopics].sort((a, b) => b.questionCount - a.questionCount).slice(0, POPULAR_COUNT);
  }, [allTopics]);

  const moreTopics = useMemo(() => {
    const ids = new Set(popularTopics.map((c) => c.id));
    return allTopics.filter((c) => !ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTopics, popularTopics]);

  const renderTopicRow = (cat: Category, colorIndex: number) => (
    <motion.button
      key={cat.id}
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/find-match/${cat.id}`)}
      className={`w-full ${CATEGORY_COLORS[colorIndex % CATEGORY_COLORS.length]} rounded-xl p-4 flex items-center gap-3 text-left`}
    >
      <span className="text-3xl shrink-0">{cat.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-foreground text-sm">{cat.name}</p>
        <p className="text-foreground/60 text-[10px]">{cat.questionCount} questions</p>
      </div>
      <ChevronRight className="w-5 h-5 text-foreground/40 shrink-0" />
    </motion.button>
  );

  return (
    <div className="min-h-screen bg-[#121212]">
      <div className="quizup-header-teal px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={user?.avatarUrl}
            alt="avatar"
            className="w-8 h-8 rounded-full border-2 border-foreground/30"
          />
          <span className="font-display font-bold text-foreground text-sm">{user?.username || "Player"}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button">
            <Search className="w-5 h-5 text-foreground/80" />
          </button>
          <button type="button" onClick={() => navigate("/settings")}>
            <Settings className="w-5 h-5 text-foreground/80" />
          </button>
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
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
          <span className="text-7xl">⚡</span>
        </div>
      </motion.button>

      <div className="bg-zinc-900/80 border-b border-zinc-800">
        <div className="flex items-center divide-x divide-zinc-800">
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Your Level</p>
            <p className="text-xl font-display font-extrabold text-white">{user?.level || 1}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Wins</p>
            <p className="text-xl font-display font-extrabold text-white">{user?.wins || 0}</p>
          </div>
          <div className="flex-1 py-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Win Streak</p>
            <p className="text-xl font-display font-extrabold text-white">{user?.winStreak || 0}🔥</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-white text-sm uppercase tracking-wider">Recent Matches</h2>
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

      <div className="px-4 pb-24">
        <h2 className="font-display font-bold text-white text-sm uppercase tracking-wider mb-3">Popular Topics</h2>
        {!topicsLoaded ? (
          <p className="text-zinc-500 text-sm py-4">Loading topics…</p>
        ) : (
          <>
            <div className="space-y-2">{popularTopics.map((cat, i) => renderTopicRow(cat, i))}</div>

            {moreTopics.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setExploreOpen((o) => !o)}
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

                <button
                  type="button"
                  onClick={() => navigate("/categories")}
                  className="w-full mt-3 py-2 text-xs text-zinc-500 hover:text-zinc-400"
                >
                  Open full topics list
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HomeLobby;
