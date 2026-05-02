import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MessageCircle, Search, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import { Category, LeaderboardEntry } from "@/types";
import { fetchFollowedCategories, fetchPublicCategories } from "@/services/categoryService";
import { leaderboardService } from "@/services/leaderboardService";
import { resolveMediaUrl } from "@/config/env";
import Icons8Icon, { getCategoryIconSlug } from "@/components/Icons8Icon";

const TILE_COLORS = ["#f65357", "#0dbf9d", "#20b7d5", "#ffc233", "#ff8d2c", "#8d65e7"];

function mergeTopics(apiList: Category[]): Category[] {
  const byId = new Map<string, Category>();
  [...apiList, ...EXTRA_HOME_TOPICS, ...MOCK_CATEGORIES].forEach((category) => {
    if (!byId.has(category.id)) byId.set(category.id, category);
  });
  return Array.from(byId.values());
}

const TopicTile: React.FC<{ category: Category; index: number; onClick: () => void }> = ({ category, index, onClick }) => {
  const { slug, fallback } = getCategoryIconSlug(category.name);

  return (
    <button type="button" onClick={onClick} className="w-[66px] shrink-0 text-center">
      <span
        className="quizup-topic-tile mx-auto h-[54px] w-[54px]"
        style={{ backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }}
      >
        <Icons8Icon
          name={slug}
          fallback={fallback}
          size={64}
          style="fluency"
          className="h-11 w-11 object-contain"
          alt=""
        />
      </span>
      <span className="mt-1 block min-h-[24px] text-[10px] font-bold leading-[11px] text-[#454545] line-clamp-2">
        {category.name}
      </span>
    </button>
  );
};

const Section: React.FC<{
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}> = ({ title, onSeeAll, children }) => (
  <section className="quizup-section">
    <div className="flex items-center justify-between px-3 py-3">
      <h2 className="quizup-section-title">{title}</h2>
      {onSeeAll && (
        <button className="quizup-see-all" onClick={onSeeAll}>
          See all
        </button>
      )}
    </div>
    <div className="px-3 pb-4">{children}</div>
  </section>
);

const HomeLobby: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [followedTopics, setFollowedTopics] = useState<Category[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

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
        if (!cancelled) setLoadingTopics(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchFollowedCategories()
      .then((list) => {
        if (!cancelled) setFollowedTopics(list);
      })
      .catch(() => {
        if (!cancelled) setFollowedTopics([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    leaderboardService.getGlobalLeaderboard()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allTopics = useMemo(() => mergeTopics(apiCategories), [apiCategories]);
  const tournaments = useMemo(() => allTopics.slice(0, 5), [allTopics]);
  const dailyChallenges = useMemo(() => allTopics.slice(5, 9), [allTopics]);
  const followed = followedTopics.length ? followedTopics.slice(0, 5) : allTopics.slice(9, 14);
  const league = getLeagueFromXp(user?.xp);
  const avatarSrc = resolveMediaUrl(
    user?.avatarUrl,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username || "player")}`
  );

  type LeagueKey =
  | "unranked"
  | "bronze"
  | "silver"
  | "gold"
  | "crystal"
  | "master"
  | "champion"
  | "titan"
  | "legend";

const LEAGUES: Array<{ key: LeagueKey; name: string; minXpInclusive: number; badgeUrl: string }> = [
  { key: "legend", name: "Legend", minXpInclusive: 20000, badgeUrl: "/leagues/legend.svg" },
  { key: "titan", name: "Titan", minXpInclusive: 15000, badgeUrl: "/leagues/titan.png" },
  { key: "champion", name: "Champion", minXpInclusive: 13000, badgeUrl: "/leagues/champion.png" },
  { key: "master", name: "Master", minXpInclusive: 10000, badgeUrl: "/leagues/master.png" },
  { key: "crystal", name: "Crystal", minXpInclusive: 7000, badgeUrl: "/leagues/crystal.png" },
  { key: "gold", name: "Gold", minXpInclusive: 5000, badgeUrl: "/leagues/gold.png" },
  { key: "silver", name: "Silver", minXpInclusive: 2000, badgeUrl: "/leagues/silver.png" },
  { key: "bronze", name: "Bronze", minXpInclusive: 1000, badgeUrl: "/leagues/bronze.png" },
  { key: "unranked", name: "Unranked", minXpInclusive: 0, badgeUrl: "/leagues/unranked.png" },
];

function getLeagueFromXp(xpRaw: unknown) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? xpRaw : 0;
  for (const league of LEAGUES) {
    if (xp >= league.minXpInclusive) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

  return (
    <div className="quizup-app">
      <div className="quizup-blackbar">
        <button onClick={() => navigate("/settings")} aria-label="Settings">
          <Settings className="h-5 w-5" />
        </button>
        <button onClick={() => navigate("/profile")} className="flex items-center gap-2">
          {/* <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" /> */}
          <span className="font-display text-[17px] font-extrabold">QuizUp</span>
        </button>
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
        </div>
      </div>

      <div className="bg-[#101010] px-3 py-2 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={avatarSrc} alt="" className="h-11 w-11 rounded-full border-2 border-white object-cover" />
            <div>
              {/* <p className="text-[11px] uppercase tracking-wide text-white/55">League {user?.level || 1}</p> */}
              <p className="font-display text-sm font-extrabold">{user?.username || "Player"}</p>
              <img src={league.badgeUrl} alt="" className="h-8 w-8 object-contain drop-shadow" />          
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-[11px] font-bold">
            <div><span className="block text-[#00cc92]">{user?.wins || 0}</span>Wins</div>
            <div><span className="block text-[#f6d22d]">{user?.winStreak || 0}</span>Streak</div>
            <div><span className="block text-white">{user?.totalMatches || 0}</span>Games</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/categories")}
        className="bg-cover bg-no-repeat bg-center quizup-pattern relative flex h-32 w-full items-center justify-between overflow-hidden px-5 text-left text-white" style={{ backgroundImage: "url('/images/banner.jpg')" }}
      >
        <div>
          <p className="font-display text-2xl font-black uppercase leading-6 drop-shadow">Challenges Galore!</p>
          <p className="mt-1 text-xs font-bold text-white/85">Pick a topic and start a lightning round.</p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl font-black">!</div>
      </button>

      {loadingTopics ? (
        <p className="py-12 text-center text-sm font-semibold text-zinc-400">Loading topics...</p>
      ) : (
        <>
          <Section title="Tournaments" onSeeAll={() => navigate("/categories")}>
            <div className="flex gap-3 overflow-x-auto">
              {tournaments.map((cat, index) => (
                <TopicTile key={cat.id} category={cat} index={index} onClick={() => navigate(`/category/${cat.id}`)} />
              ))}
            </div>
          </Section>

          <Section title="Daily Challenges">
            <div className="grid grid-cols-4 gap-2">
              {dailyChallenges.map((cat, index) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(`/category/${cat.id}`)}
                  className="rounded border border-[#d5d5d5] bg-white p-1.5 text-center shadow-[0_2px_5px_rgba(0,0,0,0.16)]"
                >
                  <span
                    className="quizup-topic-tile mx-auto flex h-12 w-12"
                    style={{ backgroundColor: TILE_COLORS[(index + 2) % TILE_COLORS.length] }}
                  >
                    <Icons8Icon
                      name={getCategoryIconSlug(cat.name).slug}
                      fallback={getCategoryIconSlug(cat.name).fallback}
                      size={64}
                      style="fluency"
                      className="h-10 w-10 object-contain"
                      alt=""
                    />
                  </span>
                  <span className="mt-1 block min-h-[24px] text-[9px] font-bold leading-[10px] text-[#454545] line-clamp-2">
                    {cat.name}
                  </span>
                  <div className="mt-1 h-1 rounded bg-[#ededed]">
                    <div className="h-full w-1/5 rounded bg-[#f65357]" />
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Invite & Play with friends!" onSeeAll={() => navigate("/leaderboard")}>
            <div className="flex gap-4 overflow-x-auto">
              {entries.slice(0, 4).map((entry) => (
                <button
                  key={entry.userId}
                  type="button"
                  onClick={() => navigate(`/profile/${entry.userId}`)}
                  className="w-[58px] shrink-0 text-center"
                >
                  <img
                    src={resolveMediaUrl(entry.avatarUrl, `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`)}
                    alt=""
                    className="mx-auto h-12 w-12 rounded-full border-2 border-[#f65357] object-cover"
                  />
                  <span className="mt-1 block truncate text-[10px] font-bold text-[#444]">{entry.username}</span>
                </button>
              ))}
              <button onClick={() => navigate("/leaderboard")} className="w-[58px] shrink-0 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#f65357] bg-[#ffd13b] text-2xl font-black text-[#121212]">
                  +
                </span>
                <span className="mt-1 block text-[10px] font-bold text-[#444]">Invite</span>
              </button>
            </div>
          </Section>

          <Section title="Followed Topics" onSeeAll={() => navigate("/categories")}>
            <div className="flex gap-3 overflow-x-auto">
              {followed.map((cat, index) => (
                <TopicTile key={cat.id} category={cat} index={index + 4} onClick={() => navigate(`/category/${cat.id}`)} />
              ))}
            </div>
          </Section>
        </>
      )}

      {/* <button
        className="fixed right-[calc(50%-13rem)] top-24 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#f65357] shadow-lg max-[450px]:right-3"
        onClick={() => navigate("/notifications")}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </button> */}
    </div>
  );
};

export default HomeLobby;
