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
      {/* ── Incoming Challenge Banner ───────────────────────────────────────── */}
      {incomingChallenge && (
        <div
          className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
          style={{ animation: "slideUpIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          <style>{`
            @keyframes slideUpIn {
              from { opacity: 0; transform: translateY(40px) scale(0.95); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 4px 20px rgba(246,83,87,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Swords className="h-4 w-4 text-[#f65357]" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#f65357]">Challenge Received</span>
              </div>
              <button
                type="button"
                onClick={() => respondToChallenge("reject")}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 transition-colors"
                aria-label="Dismiss challenge"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Challenger info */}
            <div className="flex items-center gap-4 px-5 py-3">
              <div className="relative shrink-0">
                <img
                  src={resolveMediaUrl(
                    incomingChallenge.from.avatarUrl,
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingChallenge.from.username)}`
                  )}
                  alt=""
                  className="h-14 w-14 rounded-full border-2 object-cover"
                  style={{ borderColor: "#f65357", boxShadow: "0 0 16px rgba(246,83,87,0.4)" }}
                />
                <span
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                  style={{ background: "#f65357", boxShadow: "0 2px 6px rgba(246,83,87,0.5)" }}
                >⚔️</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-base text-white truncate">{incomingChallenge.from.username}</p>
                <p className="text-[11px] text-white/50 font-semibold mt-0.5">wants to battle you!</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-wide">
                    {incomingChallenge.categoryName}
                  </span>
                </div>
              </div>
            </div>

            {/* 3D Buttons */}
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 pt-2">
              {/* Reject button */}
              <button
                type="button"
                disabled={challengeResponding}
                onClick={() => respondToChallenge("reject")}
                className="relative h-12 rounded-2xl font-black text-sm text-white tracking-wide active:translate-y-[2px] transition-transform duration-75 disabled:opacity-60"
                style={{
                  background: "linear-gradient(to bottom, #6b6b6b, #3a3a3a)",
                  boxShadow: "0 6px 0 #1a1a1a, 0 8px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                Decline
              </button>
              {/* Accept button */}
              <button
                type="button"
                disabled={challengeResponding}
                onClick={() => respondToChallenge("accept")}
                className="relative h-12 rounded-2xl font-black text-sm text-white tracking-wide active:translate-y-[2px] transition-transform duration-75 disabled:opacity-60"
                style={{
                  background: "linear-gradient(to bottom, #ff6b6b, #f65357, #c0392b)",
                  boxShadow: "0 6px 0 #8b1a1a, 0 8px 16px rgba(246,83,87,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
              >
                {challengeResponding ? "Starting…" : "Accept ⚔️"}
              </button>
            </div>
          </div>
        </div>
      )}
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

      {/* ── Inline Challenge Section (visible while challenge is pending) ─── */}
      {incomingChallenge && (
        <section
          className="mx-3 my-3 rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 2px 12px rgba(246,83,87,0.2), inset 0 1px 0 rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.09)",
            animation: "challengeSectionIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <style>{`
            @keyframes challengeSectionIn {
              from { opacity: 0; transform: scaleY(0.85) translateY(-8px); }
              to   { opacity: 1; transform: scaleY(1) translateY(0); }
            }
          `}</style>

          {/* Section header */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-1">
            <Swords className="h-4 w-4 text-[#f65357] shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest text-[#f65357]">Incoming Challenge</span>
            <span className="ml-auto flex h-2 w-2 rounded-full bg-[#f65357]" style={{ boxShadow: "0 0 6px #f65357" }} />
          </div>

          {/* Challenger row */}
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="relative shrink-0">
              <img
                src={resolveMediaUrl(
                  incomingChallenge.from.avatarUrl,
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingChallenge.from.username)}`
                )}
                alt=""
                className="h-16 w-16 rounded-full border-[3px] object-cover"
                style={{ borderColor: "#f65357", boxShadow: "0 0 18px rgba(246,83,87,0.45)" }}
              />
              <span
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{ background: "linear-gradient(135deg,#ff6b6b,#c0392b)", boxShadow: "0 2px 8px rgba(246,83,87,0.5)" }}
              >⚔️</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-lg text-white truncate leading-tight">{incomingChallenge.from.username}</p>
              <p className="text-[12px] text-white/55 font-semibold mt-0.5">challenges you to a duel!</p>
              <div
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: "rgba(246,83,87,0.15)", border: "1px solid rgba(246,83,87,0.3)" }}
              >
                <span className="text-[10px] font-black text-[#ff8080] uppercase tracking-widest">
                  {incomingChallenge.categoryName}
                </span>
              </div>
            </div>
          </div>

          {/* 3D Accept / Decline buttons */}
          <div className="grid grid-cols-2 gap-3 px-4 pb-5 pt-1">
            <button
              type="button"
              disabled={challengeResponding}
              onClick={() => respondToChallenge("reject")}
              className="relative h-14 rounded-2xl font-black text-[15px] text-white tracking-wide select-none disabled:opacity-60"
              style={{
                background: "linear-gradient(to bottom, #747474 0%, #424242 60%, #2e2e2e 100%)",
                boxShadow: "0 7px 0 #111, 0 10px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
                transform: "translateY(0)",
                transition: "transform 0.07s, box-shadow 0.07s",
              }}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(4px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 3px 0 #111, 0 5px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)";
              }}
              onPointerUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 7px 0 #111, 0 10px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)";
              }}
              onPointerLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 7px 0 #111, 0 10px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)";
              }}
            >
              Decline
            </button>
            <button
              type="button"
              disabled={challengeResponding}
              onClick={() => respondToChallenge("accept")}
              className="relative h-14 rounded-2xl font-black text-[15px] text-white tracking-wide select-none disabled:opacity-60"
              style={{
                background: "linear-gradient(to bottom, #ff7070 0%, #f65357 45%, #c0392b 100%)",
                boxShadow: "0 7px 0 #7b1010, 0 10px 24px rgba(246,83,87,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
                transform: "translateY(0)",
                transition: "transform 0.07s, box-shadow 0.07s",
              }}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(4px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 3px 0 #7b1010, 0 5px 12px rgba(246,83,87,0.4), inset 0 1px 0 rgba(255,255,255,0.2)";
              }}
              onPointerUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 7px 0 #7b1010, 0 10px 24px rgba(246,83,87,0.5), inset 0 1px 0 rgba(255,255,255,0.3)";
              }}
              onPointerLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 7px 0 #7b1010, 0 10px 24px rgba(246,83,87,0.5), inset 0 1px 0 rgba(255,255,255,0.3)";
              }}
            >
              {challengeResponding ? "Starting…" : "Accept ⚔️"}
            </button>
          </div>
        </section>
      )}

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
