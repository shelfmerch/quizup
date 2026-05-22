import React, { useEffect, useState, useMemo } from "react";
import { leaderboardService } from "@/services/leaderboardService";
import { LeaderboardEntry } from "@/types";
import { useNavigate, useLocation } from "react-router-dom";
import { Settings, Search, MessageCircle, Globe, Tag, ArrowLeft } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OnlineIndicator } from "@/components/ui/OnlineIndicator";


// ─── League helpers ────────────────────────────────────────────────────────────
type LeagueKey = "unranked" | "bronze" | "silver" | "gold" | "crystal" | "master" | "champion" | "titan" | "legend";

const LEAGUES: Array<{ key: LeagueKey; name: string; minXpInclusive: number; badgeUrl: string }> = [
  { key: "legend",   name: "Legend",   minXpInclusive: 20000, badgeUrl: "/leagues/legend.svg" },
  { key: "titan",    name: "Titan",    minXpInclusive: 15000, badgeUrl: "/leagues/titan.png" },
  { key: "champion", name: "Champion", minXpInclusive: 13000, badgeUrl: "/leagues/champion.png" },
  { key: "master",   name: "Master",   minXpInclusive: 10000, badgeUrl: "/leagues/master.png" },
  { key: "crystal",  name: "Crystal",  minXpInclusive: 7000,  badgeUrl: "/leagues/crystal.png" },
  { key: "gold",     name: "Gold",     minXpInclusive: 5000,  badgeUrl: "/leagues/gold.png" },
  { key: "silver",   name: "Silver",   minXpInclusive: 2000,  badgeUrl: "/leagues/silver.png" },
  { key: "bronze",   name: "Bronze",   minXpInclusive: 1000,  badgeUrl: "/leagues/bronze.png" },
  { key: "unranked", name: "Unranked", minXpInclusive: 0,     badgeUrl: "/leagues/unranked.png" },
];

function getLeagueFromXp(xpRaw: unknown) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  for (const league of LEAGUES) {
    if (xp >= league.minXpInclusive) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

// ─── Podium skeleton ───────────────────────────────────────────────────────────
const PodiumSkeleton: React.FC = () => (
  <div className="flex items-end justify-center gap-4 px-4 pt-5 pb-8">
    {[56, 72, 56].map((size, i) => (
      <div key={i} className="flex flex-col items-center gap-2 flex-1">
        <div className={`w-${i === 1 ? 24 : 16} h-${i === 1 ? 24 : 16} rounded-full bg-slate-200 animate-pulse`} style={{ width: size, height: size }} />
        <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
      </div>
    ))}
  </div>
);

// ─── Router state shape ────────────────────────────────────────────────────────
interface LeaderboardNavState {
  categoryId?: string;
  categoryName?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────
type Tab = "global" | "category";

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LeaderboardNavState;

  // If we arrived from a category page, default to category tab
  const hasCategoryCtx = !!(state.categoryId && state.categoryName);
  const [activeTab, setActiveTab] = useState<Tab>(hasCategoryCtx ? "category" : "global");

  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [categoryEntries, setCategoryEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(hasCategoryCtx);

  // Fetch global
  useEffect(() => {
    leaderboardService.getGlobalLeaderboard()
      .then((data) => setGlobalEntries(data))
      .catch(() => setGlobalEntries([]))
      .finally(() => setLoadingGlobal(false));
  }, []);

  // Fetch category (only when we have a categoryId)
  useEffect(() => {
    if (!state.categoryId) { setLoadingCategory(false); return; }
    setLoadingCategory(true);
    leaderboardService.getCategoryLeaderboard(state.categoryId)
      .then((data) => setCategoryEntries(data))
      .catch(() => setCategoryEntries([]))
      .finally(() => setLoadingCategory(false));
  }, [state.categoryId]);

  const entries = activeTab === "global" ? globalEntries : categoryEntries;
  const loading  = activeTab === "global" ? loadingGlobal  : loadingCategory;

  const userIds = useMemo(() => entries.map((entry) => entry.userId), [entries]);
  const { isOnline } = useOnlineStatus(userIds);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-10">
      {/* Top bar */}
      <div className="quizup-blackbar">
        <button onClick={() => navigate("/settings")} aria-label="Settings">
          <Settings className="h-5 w-5" />
        </button>
        <button onClick={() => navigate("/profile")} className="flex items-center gap-2">
          <span className="font-display text-[17px] font-extrabold">QuizUp</span>
        </button>
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
        </div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#101010] backdrop-blur-md">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          {hasCategoryCtx && (
            <button onClick={() => navigate(-1)} className="text-white p-1 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="font-display font-bold text-3xl text-white tracking-tight">
              Leaderboard
            </h1>
            {/* {activeTab === "category" && state.categoryName && (
              <p className="text-xs text-purple-400 font-semibold mt-0.5 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {state.categoryName}
              </p>
            )} */}
          </div>
        </div>

        {/* Tab toggle — only show when we have a category context */}
        {hasCategoryCtx && (
          <div className="flex border-b border-white/10">
            {(["category", "global"] as Tab[]).map((tab) => {
              const Icon = tab === "global" ? Globe : Tag;
              const label = tab === "global" ? "Global" : state.categoryName ?? "Category";
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                    activeTab === tab
                      ? "border-purple-500 text-purple-400"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[120px]">{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <>
          <PodiumSkeleton />
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-16 ${i % 2 === 0 ? "bg-slate-100" : "bg-white"} animate-pulse border-b border-slate-200`} />
            ))}
          </div>
        </>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 px-8 text-center">
          <div className="text-5xl">🏆</div>
          <p className="font-bold text-slate-700 text-lg">No rankings yet</p>
          <p className="text-slate-400 text-sm">
            {activeTab === "category"
              ? `Be the first to play ${state.categoryName ?? "this category"}!`
              : "Play matches to appear on the global leaderboard."}
          </p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="relative pt-5 pb-8 flex justify-center items-end px-4 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none flex justify-center items-center -top-12">
              <div className={`w-[300px] h-[300px] blur-3xl rounded-full ${
                activeTab === "category"
                  ? "bg-gradient-to-tr from-purple-500/60 to-pink-500/60"
                  : "bg-gradient-to-tr from-pink-400/70 to-red-500/70"
              }`} />
            </div>

            <div className="flex items-end justify-center gap-4 relative z-10 w-full max-w-sm">
              {/* 2nd */}
              {entries[1] && (
                <div className="relative flex flex-col items-center mb-2 cursor-pointer flex-1" onClick={() => navigate(`/profile/${entries[1].userId}`)}>
                  <div className="text-emerald-500 text-xs mb-2">▲</div>
                  <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-lg">
                    <img src={entries[1].avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] border-white object-cover" />
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-cyan-400 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-sm">2</div>
                    <OnlineIndicator
                      isOnline={isOnline(entries[1].userId)}
                      className="absolute top-1 right-1 border-2 border-white rounded-full"
                    />
                  </div>
                  <p className="mt-4 text-xs sm:text-sm font-bold text-slate-900 truncate w-full text-center px-1">{entries[1].username}</p>
                  <p className="text-[10px] font-semibold text-cyan-600 mt-0.5">{entries[1].score.toLocaleString()}</p>
                </div>
              )}

              {/* 1st */}
              {entries[0] && (
                <div className="relative flex flex-col items-center -mt-6 cursor-pointer flex-1" onClick={() => navigate(`/profile/${entries[0].userId}`)}>
                  <div className="text-yellow-500 text-3xl mb-2 drop-shadow-md">👑</div>
                  <div className="relative p-[4px] rounded-full bg-gradient-to-tr from-yellow-300 to-orange-500 shadow-xl">
                    <img src={entries[0].avatarUrl} alt="" className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white object-cover" />
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-yellow-400 text-white font-black text-sm flex items-center justify-center border-2 border-white shadow-md">1</div>
                    <OnlineIndicator
                      isOnline={isOnline(entries[0].userId)}
                      className="absolute top-2 right-2 border-2 border-white rounded-full"
                    />
                  </div>
                  <p className="mt-5 text-sm sm:text-base font-bold text-slate-900 truncate w-full text-center px-1">{entries[0].username}</p>
                  <p className="text-xs font-semibold text-yellow-600 mt-0.5">{entries[0].score.toLocaleString()}</p>
                </div>
              )}

              {/* 3rd */}
              {entries[2] && (
                <div className="relative flex flex-col items-center mb-2 cursor-pointer flex-1" onClick={() => navigate(`/profile/${entries[2].userId}`)}>
                  <div className="text-rose-500 text-xs mb-2">▼</div>
                  <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 shadow-lg">
                    <img src={entries[2].avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] border-white object-cover" />
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-pink-400 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-sm">3</div>
                    <OnlineIndicator
                      isOnline={isOnline(entries[2].userId)}
                      className="absolute top-1 right-1 border-2 border-white rounded-full"
                    />
                  </div>
                  <p className="mt-4 text-xs sm:text-sm font-bold text-slate-900 truncate w-full text-center px-1">{entries[2].username}</p>
                  <p className="text-[10px] font-semibold text-pink-600 mt-0.5">{entries[2].score.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Rest of the list */}
          <div className="w-full pb-5">
            {entries.slice(3).map((entry, idx) => (
              <button
                key={entry.userId}
                onClick={() => navigate(`/profile/${entry.userId}`)}
                className={`w-full flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-slate-200 last:border-0 active:bg-slate-200/60 transition-colors group ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-100"
                }`}
              >
                <span className="text-slate-400 font-bold text-sm w-6 text-center shrink-0">#{idx + 4}</span>
                <div className="relative shrink-0">
                  <img src={entry.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 group-hover:border-slate-300 transition-colors" />
                  <OnlineIndicator
                    isOnline={isOnline(entry.userId)}
                    className="absolute bottom-0 right-0 border-2 border-white rounded-full"
                  />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{entry.username}</p>
                  <p className="text-[9px] font-semibold text-slate-500 mt-0.5 truncate">
                    {entry.score.toLocaleString()} {activeTab === "global" ? "XP" : "pts"}
                  </p>
                </div>
                <div className="w-3 flex justify-center">
                  {idx % 3 === 0 ? (
                    <span className="text-rose-500 text-xs">▼</span>
                  ) : (
                    <span className="text-emerald-500 text-xs">▲</span>
                  )}
                </div>
                <div className="flex items-center gap-4 pl-2">
                  <img src={getLeagueFromXp(entry.score).badgeUrl} alt={getLeagueFromXp(entry.score).name} className="w-5 h-5 object-cover" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
