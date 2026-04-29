import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Trophy, Star, Users, BookOpen } from "lucide-react";
import { fetchPublicCategories } from "@/services/categoryService";
import { leaderboardService } from "@/services/leaderboardService";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import { Category, LeaderboardEntry } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { fetchFollowedCategories, followCategory, unfollowCategory } from "@/services/categoryService";

const CATEGORY_THEMES: Record<
  string,
  { header: string; accent: string; glow: string }
> = {
  "quizup-header-red":    { header: "quizup-header-red",    accent: "#e05252", glow: "rgba(224,82,82,0.35)" },
  "quizup-header-green":  { header: "quizup-header-green",  accent: "#2dbd7e", glow: "rgba(45,189,126,0.35)" },
  "quizup-header-teal":   { header: "quizup-header-teal",   accent: "#1aaa9b", glow: "rgba(26,170,155,0.35)" },
  "quizup-header-blue":   { header: "quizup-header-blue",   accent: "#3d8ef0", glow: "rgba(61,142,240,0.35)" },
  "quizup-header-purple": { header: "quizup-header-purple", accent: "#9966cc", glow: "rgba(153,102,204,0.35)" },
  "quizup-header-orange": { header: "quizup-header-orange", accent: "#e87030", glow: "rgba(232,112,48,0.35)" },
  "bg-white":             { header: "bg-white",             accent: "#555555", glow: "rgba(200,200,200,0.35)" },
};

const CATEGORY_COLORS = [
  "quizup-header-red",
  "quizup-header-green",
  "quizup-header-teal",
  "quizup-header-blue",
  "quizup-header-purple",
  "quizup-header-orange",
  "bg-white",
];

const MEDAL = ["🥇", "🥈", "🥉"];

function mergeAllCategories(): Category[] {
  const byId = new Map<string, Category>();
  MOCK_CATEGORIES.forEach((c) => byId.set(c.id, c));
  EXTRA_HOME_TOPICS.forEach((c) => { if (!byId.has(c.id)) byId.set(c.id, c); });
  return Array.from(byId.values());
}

const CategoryDetail: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = !!user?.id;

  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  // Fetch live categories from API
  useEffect(() => {
    let cancelled = false;
    fetchPublicCategories()
      .then((list) => { if (!cancelled) setApiCategories(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Find the category from merged data
  const allCategories = useMemo(() => {
    const local = mergeAllCategories();
    const byId = new Map<string, Category>();
    local.forEach((c) => byId.set(c.id, c));
    apiCategories.forEach((c) => byId.set(c.id, c)); // API wins
    return Array.from(byId.values());
  }, [apiCategories]);

  const category = useMemo(
    () => allCategories.find((c) => c.id === categoryId) ?? null,
    [allCategories, categoryId]
  );

  // Determine theme color based on list order
  const themeKey = useMemo(() => {
    const idx = allCategories.findIndex((c) => c.id === categoryId);
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
  }, [allCategories, categoryId]);

  const theme = CATEGORY_THEMES[themeKey] ?? CATEGORY_THEMES["quizup-header-teal"];

  // Fetch top 5 leaderboard for this category
  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    setPlayersLoading(true);
    leaderboardService
      .getCategoryLeaderboard(categoryId)
      .then((entries) => {
        if (!cancelled) setTopPlayers(entries.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setTopPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setPlayersLoading(false);
      });
    return () => { cancelled = true; };
  }, [categoryId]);

  // Fetch follow state for this category (most recent follows persisted in backend)
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !categoryId) {
      setIsFollowed(false);
      return () => {
        cancelled = true;
      };
    }

    fetchFollowedCategories()
      .then((list) => {
        if (cancelled) return;
        setIsFollowed(list.some((c) => c.id === categoryId));
      })
      .catch(() => {
        if (!cancelled) setIsFollowed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, categoryId]);

  // Mock stats for visual richness
  const mockFollowers = useMemo(() => {
    if (!categoryId) return 0;
    const seed = categoryId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    return 1000 + (seed * 137) % 49000;
  }, [categoryId]);

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto">
      {/* ── Header Bar ───────────────────────────────────────────────────────── */}
      <div className={`${theme.header} px-4 py-3 flex items-center justify-between shrink-0 shadow-sm sticky top-0 z-50`}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-white p-1 -ml-1 rounded-full active:bg-black/10"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-white text-base tracking-tight">
          {category.name}
        </h1>
        <div className="w-6" /> {/* spacer */}
      </div>

      {/* ── Hero: Icon + Action Buttons ──────────────────────────────────────── */}
      <div className="bg-white px-5 pt-7 pb-6 shadow-sm">
        <div className="flex items-center gap-5">
          {/* Big icon circle */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="shrink-0 w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${theme.accent}55, ${theme.accent}22)`,
              border: `2px solid ${theme.accent}66`,
              boxShadow: `0 0 32px ${theme.glow}`,
            }}
          >
            {category.icon}
          </motion.div>

          {/* Action pills */}
          <div className="flex flex-col gap-2.5 flex-1">
            <motion.button
              type="button"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/find-match/${category.id}`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white active:opacity-80"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
                boxShadow: `0 4px 14px ${theme.glow}`,
              }}
            >
              <Play className="w-4 h-4 fill-white" />
              Play
            </motion.button>

            <motion.button
              type="button"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              whileTap={{ scale: 0.96 }}
              disabled={!isAuthenticated || followBusy}
              onClick={async () => {
                if (!categoryId || !isAuthenticated) return;
                setFollowBusy(true);
                try {
                  if (isFollowed) {
                    await unfollowCategory(categoryId);
                    setIsFollowed(false);
                  } else {
                    await followCategory(categoryId);
                    setIsFollowed(true);
                  }
                } finally {
                  setFollowBusy(false);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border active:bg-slate-100 ${
                isAuthenticated ? "bg-white text-slate-700 border-slate-200" : "bg-slate-50 text-slate-400 border-slate-100"
              } ${followBusy ? "opacity-60" : ""}`}
            >
              <Star className={`w-4 h-4 ${isFollowed ? "text-amber-400 fill-amber-400" : "text-slate-300"}`} />
              {isFollowed ? "Following" : "Follow"}
            </motion.button>

            <motion.button
              type="button"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/leaderboard`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-white text-slate-700 border border-slate-200 active:bg-slate-50"
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              Rankings
            </motion.button>
          </div>
        </div>

        {/* Category title + description under the row */}
        <div className="mt-5">
          <p className="font-display font-extrabold text-slate-900 text-xl tracking-tight">
            {category.name}
          </p>
          {category.description && (
            <p className="text-slate-500 text-sm mt-0.5">{category.description}</p>
          )}
        </div>
      </div>

      {/* ── Questions Completed Progress ──────────────────────────────────────── */}
      <div className="bg-white/60 border-t border-slate-100 px-5 py-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
          Questions Completed
        </p>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: "0%",
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}88)`,
            }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">0%</p>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-slate-100">
        <div className="flex items-center divide-x divide-slate-100">
          <div className="flex-1 py-4 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">
              Your Level
            </p>
            <p className="text-2xl font-display font-extrabold text-slate-900 leading-none">
              {user?.level ?? 1}
            </p>
          </div>
          <div className="flex-1 py-4 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">
              Followers
            </p>
            <p className="text-2xl font-display font-extrabold text-slate-900 leading-none">
              {mockFollowers.toLocaleString()}
            </p>
          </div>
          <div className="flex-1 py-4 text-center">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">
              Question Count
            </p>
            <p className="text-2xl font-display font-extrabold text-slate-900 leading-none">
              {category.questionCount}
            </p>
          </div>
        </div>
      </div>
      {/* ── Top 5 Players ─────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-28">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h2 className="font-display font-bold text-slate-800 text-sm uppercase tracking-wider">
            Top Players
          </h2>
        </div>

        {playersLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-white border border-slate-100 animate-pulse"
              />
            ))}
          </div>
        ) : topPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Users className="w-10 h-10 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No rankings yet — be the first to play!</p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/find-match/${category.id}`)}
              className="mt-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}aa)`,
                boxShadow: `0 4px 12px ${theme.glow}`,
              }}
            >
              Play now
            </motion.button>
          </div>
        ) : (
          <div className="space-y-2">
            {topPlayers.map((player, idx) => (
              <motion.button
                key={player.userId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                type="button"
                onClick={() => navigate(`/profile/${player.userId}`)}
                className="relative w-full text-left flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 overflow-hidden shadow-sm hover:border-slate-200 active:scale-[0.99] transition"
              >
                {/* subtle rank glow strip on left */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                  style={{
                    background:
                      idx === 0
                        ? "linear-gradient(180deg,#FFD700,#FFA500)"
                        : idx === 1
                        ? "linear-gradient(180deg,#C0C0C0,#A0A0A0)"
                        : "linear-gradient(180deg,#CD7F32,#A0522D)",
                  }}
                />
                <span className="text-xl shrink-0 ml-1">{idx < 3 ? MEDAL[idx] : `#${idx + 1}`}</span>
                <img
                  src={
                    player.avatarUrl ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.username}`
                  }
                  alt=""
                  className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {player.username}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Level {player.level} · {player.wins} wins
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className="text-base font-display font-extrabold tabular-nums"
                    style={{ color: theme.accent }}
                  >
                    {player.score.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">pts</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Play CTA at bottom */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(`/find-match/${category.id}`)}
          className="w-full mt-6 h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
            boxShadow: `0 6px 20px ${theme.glow}`,
          }}
        >
          <Play className="w-5 h-5 fill-white" />
          Play {category.name}
        </motion.button>
      </div>
    </div>
  );
};

export default CategoryDetail;
