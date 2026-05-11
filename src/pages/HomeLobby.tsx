import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search, Settings, Swords, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import { Category, LeaderboardEntry, MatchFoundPayload } from "@/types";
import { fetchFollowedCategories, fetchPublicCategories } from "@/services/categoryService";
import { leaderboardService } from "@/services/leaderboardService";
import { resolveMediaUrl } from "@/config/env";
import Icons8Icon, { getCategoryIconSlug } from "@/components/Icons8Icon";
import { getSocket } from "@/services/socketService";

interface IncomingChallenge {
  id: string;
  from: { userId: string; username: string; avatarUrl: string };
  categoryId: string;
  categoryName: string;
}

const TILE_COLORS = ["#f65357", "#0dbf9d", "#20b7d5", "#ffc233", "#ff8d2c", "#8d65e7"];

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

const LEAGUES: Array<{ key: LeagueKey; name: string; minLevel: number; minXpInclusive: number; badgeUrl: string }> = [
  { key: "legend",   name: "Legend",   minLevel: 9, minXpInclusive: 20000, badgeUrl: "/leagues/legend.svg" },
  { key: "titan",    name: "Titan",    minLevel: 7, minXpInclusive: 15000, badgeUrl: "/leagues/titan.png" },
  { key: "champion", name: "Champion", minLevel: 6, minXpInclusive: 13000, badgeUrl: "/leagues/champion.png" },
  { key: "master",   name: "Master",   minLevel: 5, minXpInclusive: 10000, badgeUrl: "/leagues/master.png" },
  { key: "crystal",  name: "Crystal",  minLevel: 4, minXpInclusive: 7000,  badgeUrl: "/leagues/crystal.png" },
  { key: "gold",     name: "Gold",     minLevel: 3, minXpInclusive: 5000,  badgeUrl: "/leagues/gold.png" },
  { key: "silver",   name: "Silver",   minLevel: 2, minXpInclusive: 2000,  badgeUrl: "/leagues/silver.png" },
  { key: "bronze",   name: "Bronze",   minLevel: 1, minXpInclusive: 1000,  badgeUrl: "/leagues/bronze.png" },
  { key: "unranked", name: "Unranked", minLevel: 0, minXpInclusive: 0,     badgeUrl: "/leagues/unranked.png" },
];

function getLeagueFromXp(xpRaw: unknown) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  for (const league of LEAGUES) {
    if (xp >= league.minXpInclusive) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

/** Public-folder league art (respects Vite `base`). */
function leagueBadgeSrc(badgeUrl: string): string {
  const path = badgeUrl.startsWith("/") ? badgeUrl.slice(1) : badgeUrl;
  return `${import.meta.env.BASE_URL}${path}`;
}

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
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [challengeResponding, setChallengeResponding] = useState(false);
  // keep latest phase ref so cleanup effect can read it
  const challengeRef = useRef(incomingChallenge);
  challengeRef.current = incomingChallenge;

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // ── Challenge socket listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let socket: ReturnType<typeof getSocket>;
    try { socket = getSocket(); } catch { return; }

    const onReceived = (ch: IncomingChallenge) => {
      setIncomingChallenge(ch);
      setChallengeResponding(false);
    };

    const onCancelled = ({ challengeId }: { challengeId: string }) => {
      setIncomingChallenge((prev) => (prev?.id === challengeId ? null : prev));
    };

    const onMatchFound = (p: MatchFoundPayload) => {
      setIncomingChallenge(null);
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

    socket.on("challenge:received", onReceived);
    socket.on("challenge:cancelled", onCancelled);
    socket.on("match_found", onMatchFound);

    return () => {
      socket.off("challenge:received", onReceived);
      socket.off("challenge:cancelled", onCancelled);
      socket.off("match_found", onMatchFound);
    };
  }, [user?.id, user?.avatarUrl, user?.level, user?.username, navigate]);

  const respondToChallenge = (action: "accept" | "reject") => {
    const ch = incomingChallenge;
    if (!ch || challengeResponding) return;
    setChallengeResponding(true);
    try {
      getSocket().emit("challenge:respond", { challengeId: ch.id, action });
    } catch { /* ignore */ }
    if (action === "reject") {
      setIncomingChallenge(null);
      setChallengeResponding(false);
    }
    // On accept: wait for match_found which clears the banner and navigates
  };

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

  return (
    <div className="quizup-app">
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

      <div className="bg-[#101010] px-3 py-2 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={avatarSrc} alt="" className="h-11 w-11 rounded-full border-2 border-white object-cover" />
            <div>
              <p className="font-display text-sm font-extrabold">{user?.username || "Player"}</p>
              <img src={leagueBadgeSrc(league.badgeUrl)} alt="" className="h-6 w-6 object-contain drop-shadow" />
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
        className="bg-cover bg-no-repeat bg-center quizup-pattern relative flex h-36 w-full items-center justify-between overflow-hidden px-5 text-left text-white" style={{ backgroundImage: "url('/images/banner.jpg')" }}
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

          <Section title="Challenges">
            <style>{`
              @keyframes challengeSlideIn {
                from { opacity: 0; transform: translateY(-12px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>
            {incomingChallenge ? (
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  animation: "challengeSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
                  background: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
                  border: "1px solid rgba(246,83,87,0.35)",
                  boxShadow: "0 4px 24px rgba(246,83,87,0.15), inset 0 1px 0 rgba(255,255,255,0.07)",
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Swords className="h-3.5 w-3.5 text-[#f65357]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#f65357]">Incoming Challenge</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => respondToChallenge("reject")}
                    className="h-6 w-6 flex items-center justify-center rounded-full bg-white/10 text-white/40 hover:bg-white/20 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Challenger info + buttons */}
                <div className="flex items-center gap-3 px-4 pb-4 pt-2">
                  {/* Category Icon */}
                  <div className="relative shrink-0 flex items-center justify-center h-16 w-16 rounded-xl bg-white/10 border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]">
                    {incomingChallenge && (
                      <Icons8Icon
                        name={getCategoryIconSlug(incomingChallenge.categoryName).slug}
                        fallback={getCategoryIconSlug(incomingChallenge.categoryName).fallback}
                        size={74}
                        style="fluency"
                        className="h-16 w-16 object-contain"
                        alt=""
                      />
                    )}
                    {/* <span
                      className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] shadow-sm"
                      style={{ background: "#f65357" }}
                    >⚔️</span> */}
                  </div>

                  {/* Name + category */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <img
                        src={resolveMediaUrl(
                          incomingChallenge.from.avatarUrl,
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingChallenge.from.username)}`
                        )}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover border border-white/20"
                      />
                      <p className="font-black text-sm text-white truncate">{incomingChallenge.from.username}</p>
                    </div>
                    <p className="text-[10px] text-white/50 font-semibold">challenges you in</p>
                    <span className="mt-0.5 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/70 border border-white/10">
                      {incomingChallenge.categoryName}
                    </span>
                  </div>

                  {/* 3D Buttons */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={challengeResponding}
                      onClick={() => respondToChallenge("reject")}
                      className="h-9 w-20 rounded-xl font-black text-xs text-white active:translate-y-[2px] transition-transform duration-75 disabled:opacity-50"
                      style={{
                        background: "linear-gradient(to bottom, #555, #333)",
                        boxShadow: "0 4px 0 #111, 0 6px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
                      }}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={challengeResponding}
                      onClick={() => respondToChallenge("accept")}
                      className="h-9 w-20 rounded-xl font-black text-xs text-white active:translate-y-[2px] transition-transform duration-75 disabled:opacity-50"
                      style={{
                        background: "linear-gradient(to bottom, #ff6b6b, #f65357, #c0392b)",
                        boxShadow: "0 4px 0 #7b1a1a, 0 6px 14px rgba(246,83,87,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                      }}
                    >
                      {challengeResponding ? "…" : "Accept ⚔️"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between py-4 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-200/50 shrink-0">
                    <Swords className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-600 leading-tight truncate">No active challenges</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">Find someone to play</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/leaderboard")}
                  className="bg-[#f65357] text-white px-4 py-2.5 rounded-lg font-bold text-[11px] shadow-sm active:scale-95 transition-transform whitespace-nowrap shrink-0"
                >
                  Challenge
                </button>
              </div>
            )}
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
