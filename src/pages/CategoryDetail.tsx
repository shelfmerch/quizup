import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Trophy, Star, Users, BookOpen, Search, MessageCircle } from "lucide-react";
import { fetchPublicCategories } from "@/services/categoryService";
import { leaderboardService } from "@/services/leaderboardService";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import { Category, LeaderboardEntry } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { fetchFollowedCategories, followCategory, unfollowCategory } from "@/services/categoryService";
import { CategoryIcon } from "@/components/CategoryIcon";
import CommunityFeed from "@/components/community/CommunityFeed";

const CATEGORY_THEMES: Record<
  string,
  { header: string; accent: string; glow: string }
> = {
  "quizup-header-red": { header: "quizup-header-red", accent: "#e05252", glow: "rgba(224,82,82,0.35)" },
  "quizup-header-green": { header: "quizup-header-green", accent: "#2dbd7e", glow: "rgba(45,189,126,0.35)" },
  "quizup-header-teal": { header: "quizup-header-teal", accent: "#1aaa9b", glow: "rgba(26,170,155,0.35)" },
  "quizup-header-blue": { header: "quizup-header-blue", accent: "#3d8ef0", glow: "rgba(61,142,240,0.35)" },
  "quizup-header-purple": { header: "quizup-header-purple", accent: "#9966cc", glow: "rgba(153,102,204,0.35)" },
  "quizup-header-orange": { header: "quizup-header-orange", accent: "#e87030", glow: "rgba(232,112,48,0.35)" },
  "bg-white": { header: "bg-white", accent: "#555555", glow: "rgba(200,200,200,0.35)" },
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
      .catch(() => { });
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
    <div className="min-h-[100dvh] flex flex-col max-w-md mx-auto bg-[#242424] text-white">
      {/* ── Header Bar ───────────────────────────────────────────────────────── */}
      <div className={`${theme.header} px-4 h-14 flex items-center justify-between shrink-0 shadow-md sticky top-0 z-50`}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-white p-2 -ml-2 rounded-full active:bg-black/10"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-display font-bold text-white text-lg tracking-wide">
          {category.name}
        </h1>
        <div className="flex items-center gap-3">
          <button className="text-white p-1 rounded-full active:bg-black/10">
            <Search className="w-6 h-6" />
          </button>
          <button onClick={() => navigate('/social')} className="text-white p-1 rounded-full active:bg-black/10 relative">
            <MessageCircle className="w-6 h-6" />
            <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-black rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-[#242424]">1</div>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-12 relative">
        <div className="absolute inset-0 pointer-events-none opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.83-1.66 1.66-.83-.83.83-.83zM27.83 34.485L25 31.657l-1.414 1.414 2.828 2.828 1.414-1.414zm25.456-11.314L50.458 26l-1.414-1.414 2.828-2.828 1.414 1.414zM4.343 7.172L7.172 4.343l-1.414-1.414L2.93 5.758l1.414 1.414zM16.485 54.627l.83.83-1.66 1.66-.83-.83.83-.83z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>

        <div className="relative z-10 px-4 pt-8 pb-6 flex flex-col items-center">
          <h2 className="text-[2.5rem] font-display font-extrabold text-white mb-1 drop-shadow-md tracking-tight leading-none text-center">
            {category.name}
          </h2>
          {category.description && (
            <p className="text-slate-300 text-[15px] mb-6 text-center">{category.description}</p>
          )}

          <div className="flex w-full gap-4 max-w-[340px] mt-2">
            {/* Big icon square */}
            <div 
              className="quizup-topic-tile w-36 h-36 sm:w-[160px] sm:h-[160px] shrink-0"
              style={{ backgroundColor: theme.accent }}
            >
              <CategoryIcon
                category={category}
                size={96}
                style="fluency"
                className="h-24 w-24 sm:h-32 sm:w-32 object-contain"
              />
            </div>

            {/* Action pills */}
            <div className="flex flex-col justify-between flex-1 gap-2.5">
              <button
                onClick={() => navigate(`/find-match/${category.id}`)}
                className="bg-white rounded-xl flex-1 flex items-center gap-3 px-4 shadow-md font-bold active:scale-[0.98] transition-transform"
                style={{ color: theme.accent }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white`} style={{ backgroundColor: theme.accent }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                </div>
                <span className="text-[15px]">Play</span>
              </button>

              <button
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
                className={`bg-white rounded-xl flex-1 flex items-center gap-3 px-4 shadow-md font-bold active:scale-[0.98] transition-transform ${followBusy ? "opacity-70" : ""}`}
                style={{ color: '#00c853' }}
              >
                <div className="w-6 h-6 rounded-full bg-[#00c853] text-white flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-[15px]">{isFollowed ? "Following" : "Follow"}</span>
              </button>

              <button
                onClick={() => navigate(`/leaderboard`, {
                  state: { categoryId: category.id, categoryName: category.name },
                })}
                className="bg-white rounded-xl flex-1 flex items-center gap-3 px-4 shadow-md font-bold active:scale-[0.98] transition-transform"
                style={{ color: '#9c27b0' }}
              >
                <div className="w-6 h-6 rounded-full bg-[#9c27b0] text-white flex items-center justify-center">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </div>
                <span className="text-[15px]">Rankings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Questions Completed */}
        {/* <div className="px-8 py-4 relative z-10 max-w-[360px] mx-auto w-full"> */}
        {/* <p className="text-center text-[11px] font-bold text-white uppercase tracking-[0.15em] mb-2 drop-shadow">
            Questions Completed
          </p>
          <div className="h-7 rounded-full border border-white/30 bg-[#151515] flex items-center justify-center relative overflow-hidden shadow-inner">
             <div className="absolute left-0 top-0 bottom-0 w-0 bg-white/20"></div>
             <span className="text-[13px] font-bold text-white relative z-10">0%</span>
          </div> */}
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-center py-5 border-t border-b border-white/10 mt-3 px-2 relative z-10 bg-[#212121]/50 backdrop-blur-sm">
        <div className="flex-1 text-center border-r border-white/10">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold">Your Level</p>
          <p className="text-[2.5rem] font-display font-extrabold text-white leading-none tracking-tight">{user?.level ?? 1}</p>
        </div>
        <div className="flex-1 text-center border-r border-white/10">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold">Followers</p>
          <p className="text-[2.5rem] font-display font-extrabold text-white leading-none tracking-tight">{mockFollowers}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold">Question Count</p>
          <p className="text-[2.5rem] font-display font-extrabold text-white leading-none tracking-tight">{category.questionCount}</p>
        </div>
      </div>

      <section className="flex-1 overflow-y-auto border-t border-[#dddddd] bg-[#f4f4f4] px-4 pb-28 pt-4">
        {categoryId && (
          <CommunityFeed
            categoryId={categoryId}
            categoryName={category.name}
            accentColor={theme.accent}
          />
        )}
      </section>
    </div>
  );
};

export default CategoryDetail;
