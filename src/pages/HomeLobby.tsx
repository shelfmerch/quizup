import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ellipsis, MessageCircle, Search, Settings, Swords, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import { Category, LeaderboardEntry, MatchFoundPayload } from "@/types";
import { fetchFollowedCategories, fetchPublicCategories } from "@/services/categoryService";
import { leaderboardService } from "@/services/leaderboardService";
import { resolveMediaUrl } from "@/config/env";
import { CategoryIcon } from "@/components/CategoryIcon";
import { getSocket } from "@/services/socketService";
import { LeagueModal } from "@/components/LeagueModal";
import { useChatUnread } from "@/hooks/useChatUnread";
import { toast } from "sonner";

interface IncomingChallenge {
  id: string;
  from: { userId: string; username: string; avatarUrl: string };
  categoryId: string;
  categoryName: string;
}

interface SearchingUser {
  userId: string;
  username: string;
  avatarUrl: string;
  level: number;
  categoryId: string;
  categoryName: string;
  queuedAt: string;
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
  return (
    <button type="button" onClick={onClick} className="w-[66px] shrink-0 text-center">
      <span
        className="quizup-topic-tile mx-auto h-[54px] w-[54px]"
        style={{ backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }}
      >
        <CategoryIcon
          category={category}
          size={64}
          style="fluency"
          className="h-11 w-11 object-contain"
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
  const { totalUnread } = useChatUnread();
  const navigate = useNavigate();
  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [followedTopics, setFollowedTopics] = useState<Category[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [challengeResponding, setChallengeResponding] = useState(false);
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);

  // Matchmaking queue state
  const [searchingUsers, setSearchingUsers] = useState<SearchingUser[]>([]);
  const [skippedUserIds, setSkippedUserIds] = useState<Set<string>>(new Set());
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [isQueueTransitioning, setIsQueueTransitioning] = useState(false);

  const lastOpponentKeyRef = useRef<string | null>(null);

  const activeSuggestions = useMemo(() => {
    return searchingUsers.filter((u) => !skippedUserIds.has(`${u.userId}-${u.categoryId}`));
  }, [searchingUsers, skippedUserIds]);

  const allTopics = useMemo(() => mergeTopics(apiCategories), [apiCategories]);
  const tournaments = useMemo(() => allTopics.slice(0, 5), [allTopics]);
  const dailyChallenges = useMemo(() => allTopics.slice(5, 9), [allTopics]);
  const followed = followedTopics.length ? followedTopics.slice(0, 5) : allTopics.slice(9, 14);

  // Derive queueOpponent from real-time activeSuggestions state
  const queueOpponent = useMemo(() => {
    if (activeSuggestions.length === 0) return null;
    const item = activeSuggestions[currentQueueIndex % activeSuggestions.length];
    if (!item) return null;
    return {
      user: {
        userId: item.userId,
        username: item.username,
        avatarUrl: item.avatarUrl,
        level: item.level,
      },
      category: {
        id: item.categoryId,
        name: item.categoryName,
        icon: "swords",
        color: "#20b7d5",
        questionCount: 0,
        description: "",
      } as Category,
    };
  }, [activeSuggestions, currentQueueIndex]);

  const showNextQueueOpponent = () => {
    if (isQueueTransitioning || activeSuggestions.length <= 1) return;
    setIsQueueTransitioning(true);
    setTimeout(() => {
      setCurrentQueueIndex((prev) => {
        const nextIdx = (prev + 1) % activeSuggestions.length;
        const nextOpponent = activeSuggestions[nextIdx];
        if (nextOpponent) {
          lastOpponentKeyRef.current = `${nextOpponent.userId}-${nextOpponent.categoryId}`;
        }
        return nextIdx;
      });
      setIsQueueTransitioning(false);
    }, 250);
  };

  // Synchronize index and tracking key when active suggestions change
  useEffect(() => {
    if (activeSuggestions.length === 0) {
      lastOpponentKeyRef.current = null;
      setCurrentQueueIndex(0);
      return;
    }

    const lastKey = lastOpponentKeyRef.current;
    if (lastKey) {
      const idx = activeSuggestions.findIndex(
        (u) => `${u.userId}-${u.categoryId}` === lastKey
      );
      if (idx !== -1) {
        setCurrentQueueIndex(idx);
        return;
      }
    }

    // Default to the first active suggestion
    setCurrentQueueIndex(0);
    const firstItem = activeSuggestions[0];
    if (firstItem) {
      lastOpponentKeyRef.current = `${firstItem.userId}-${firstItem.categoryId}`;
    }
  }, [activeSuggestions]);

  // Poll real-time matchmaking queue data from the backend
  useEffect(() => {
    if (!user?.id) return;
    let socket: ReturnType<typeof getSocket>;
    try { socket = getSocket(); } catch { return; }

    socket.emit("queue:get_searching");

    const interval = setInterval(() => {
      socket.emit("queue:get_searching");
    }, 4000);

    return () => clearInterval(interval);
  }, [user?.id]);

  // Handle auto-cycling through active queue seekers
  useEffect(() => {
    if (incomingChallenge || queueLoading || activeSuggestions.length <= 1) return;
    const interval = setInterval(() => {
      showNextQueueOpponent();
    }, 8000);
    return () => clearInterval(interval);
  }, [incomingChallenge, queueLoading, activeSuggestions.length, isQueueTransitioning]);

  const startQueueBattle = async () => {
    if (!queueOpponent || queueLoading) return;
    setQueueLoading(true);
    try {
      getSocket().emit("challenge:instant_start", {
        opponentId: queueOpponent.user.userId,
        categoryId: queueOpponent.category.id,
      });
      toast.success(`Challenging ${queueOpponent.user.username}...`, { position: "top-center" });
    } catch (err) {
      toast.error("Failed to start battle", { position: "top-center" });
      setQueueLoading(false);
    }
  };

  const skipQueueOpponent = () => {
    if (!queueOpponent) return;
    const key = `${queueOpponent.user.userId}-${queueOpponent.category.id}`;
    setSkippedUserIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setIsQueueTransitioning(true);
    setTimeout(() => {
      setIsQueueTransitioning(false);
    }, 250);
  };

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

    const onSearchingUsers = ({ users }: { users: SearchingUser[] }) => {
      setSearchingUsers(users);
    };

    socket.on("challenge:received", onReceived);
    socket.on("challenge:cancelled", onCancelled);
    socket.on("match_found", onMatchFound);
    socket.on("queue:searching_users", onSearchingUsers);

    return () => {
      socket.off("challenge:received", onReceived);
      socket.off("challenge:cancelled", onCancelled);
      socket.off("match_found", onMatchFound);
      socket.off("queue:searching_users", onSearchingUsers);
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
          <span className="font-display text-[19px] font-extrabold">QuizUp</span>
        </button>
        <div className="flex items-center gap-3">
          {/* <Search className="h-5 w-5" /> */}
          <button
            onClick={() => navigate("/social")}
            className="relative p-1 active:scale-95 transition-transform"
            aria-label={
              totalUnread > 0
                ? `Chats, ${totalUnread} unread`
                : "Chats"
            }
          >
            <MessageCircle className="h-7 w-7" />
            {totalUnread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-400 border-1 border-[#ffffff] flex items-center justify-center text-[10px] font-bold text-[#ffffff] leading-none"
                aria-hidden
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-[#444444] px-3 py-2 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={avatarSrc} alt="" className="h-11 w-11 rounded-full border-2 border-white object-cover" />
            <div>
              <p className="font-display text-sm font-extrabold">{user?.username || "Player"}</p>
              <button 
                onClick={() => setLeagueModalOpen(true)} 
                className="hover:scale-110 transition-transform active:scale-95 cursor-pointer outline-none block mt-1"
              >
                <img src={leagueBadgeSrc(league.badgeUrl)} alt="" className="h-6 w-6 object-contain drop-shadow" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 justify-end text-center text-[9px] font-bold">
            {/* <div><img src="/images/win.png" alt="Win" className="h-7 w-7 object-contain" /> <span className="block text-white">{user?.wins || 0}</span></div>
            <div><img src="/images/rank.png" alt="Rank" className="h-7 w-7 object-contain" /> <span className="block text-white">{user?.winStreak || 0}</span></div>
            <div><img src="/images/gems.png" alt="Gems" className="h-7 w-7 object-contain" /> <span className="block text-white">{user?.totalMatches || 0}</span></div> */}
            <Ellipsis className="h-5 w-5 rotate-90" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/categories")}
        className="bg-cover bg-no-repeat bg-center quizup-pattern relative flex h-44 w-full items-center justify-between overflow-hidden px-5 text-left text-white" style={{ backgroundImage: "url('/images/galorei.png')" }}
      >
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

          <Section title="Challenges">
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap');
              @keyframes challengeSlideIn {
                from { opacity: 0; transform: translateY(-12px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
              .coc-challenge-title {
                font-family: 'Fredoka', 'Montserrat', sans-serif;
                color: #fff;
                -webkit-text-stroke: 2px #2a1608;
                paint-order: stroke fill;
                text-shadow:
                  0 2px 0 #2a1608,
                  0 3px 0 #1a0d04,
                  0 4px 6px rgba(0,0,0,0.35);
              }
              .coc-challenge-btn-label {
                color: #fff;
                -webkit-text-stroke: 1.5px #2a1608;
                paint-order: stroke fill;
                text-shadow: 0 1px 0 #2a1608, 0 2px 3px rgba(0,0,0,0.25);
              }
            `}</style>
            {incomingChallenge ? (
              <div
                className="relative mx-auto max-w-lg"
                style={{
                  animation: "challengeSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
              >
                <div
                  className="relative rounded-lg px-3 pb-3 pt-4"
                  style={{
                    background: "linear-gradient(180deg, #ffffffff 0%, #ffffffff 100%)",
                    border: "2px solid #9c9184ff",
                    boxShadow:
                      "0 0px 0 #2a1a0c, 0 8px 20px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -3px 0 rgba(61,41,20,0.12)",
                  }}
                >
                  {/* <h3 className="coc-challenge-title absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xl font-bold tracking-wide">
                    Incoming Challenge!
                  </h3> */}

                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#c4a574] bg-white/60 shadow-[inset_0_2px_6px_rgba(61,41,20,0.08)]">
                    <CategoryIcon
                      category={
                        allTopics.find((t) => t.id === incomingChallenge.categoryId) || {
                          name: incomingChallenge.categoryName,
                        }
                      }
                      size={74}
                      style="fluency"
                      className="h-12 w-12 object-contain"
                    />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="mb-0.5 flex items-center gap-2">
                        <img
                          src={resolveMediaUrl(
                            incomingChallenge.from.avatarUrl,
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingChallenge.from.username)}`
                          )}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full border-2 border-[#999999] object-cover shadow-sm"
                        />
                        <p className="truncate font-display text-[14px] font-black text-[#3d2914]">
                          {incomingChallenge.from.username}
                        </p>
                      </div>
                      <p className="font-body text-[12px] font-semibold leading-snug text-[#5c4030]">
                        challenges you in{" "}
                        <span className="font-bold text-[#3d2914]">{incomingChallenge.categoryName}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        disabled={challengeResponding}
                        onClick={() => respondToChallenge("reject")}
                        className="coc-challenge-btn-label relative w-[76px] rounded-md py-2.5 text-xs font-bold active:translate-y-[3px] transition-transform duration-75 disabled:opacity-50"
                        style={{
                          background: "linear-gradient(180deg, #ffb347 0%, #ff7b2e 45%, #e84a1a 100%)",
                          border: "px solid #2a1608",
                          boxShadow:
                            "0 2px 0 #8b2e0a, 0 8px 14px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.45)",
                        }}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={challengeResponding}
                        onClick={() => respondToChallenge("accept")}
                        className="coc-challenge-btn-label relative w-[76px] rounded-md py-2.5 text-xs font-bold active:translate-y-[3px] transition-transform duration-75 disabled:opacity-50"
                        style={{
                          background: "linear-gradient(180deg, #b8f04a 0%, #7ed321 45%, #4a9e12 100%)",
                          border: "px solid #2a1608",
                          boxShadow:
                            "0 2px 0 #2d5a0a, 0 8px 14px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.45)",
                        }}
                      >
                        {challengeResponding ? "…" : "Accept"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : queueOpponent ? (
              <div
                className="relative mx-auto max-w-lg"
                style={{
                  animation: "challengeSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
              >
                <div
                  className={`relative rounded-lg px-3 pb-3 pt-4 transition-all duration-300 ${
                    isQueueTransitioning ? "opacity-0 transform translate-y-2 scale-95" : "opacity-100 transform translate-y-0 scale-100"
                  }`}
                  style={{
                    background: "linear-gradient(180deg, #ffffffff 0%, #ffffffff 100%)",
                    border: "2px solid #9c9184ff",
                    boxShadow:
                      "0 0px 0 #2a1a0c, 0 8px 20px rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.85), inset 0 -3px 0 rgba(61,41,20,0.12)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#c4a574] bg-white/60 shadow-[inset_0_2px_6px_rgba(61,41,20,0.08)]">
                      <CategoryIcon
                        category={queueOpponent.category}
                        size={74}
                        style="fluency"
                        className="h-12 w-12 object-contain"
                      />
                    </div>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="mb-0.5 flex items-center gap-2">
                        <img
                          src={resolveMediaUrl(
                            queueOpponent.user.avatarUrl,
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(queueOpponent.user.username)}`
                          )}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full border-2 border-[#999999] object-cover shadow-sm"
                        />
                        <p className="truncate font-display text-[14px] font-black text-[#3d2914]">
                          {queueOpponent.user.username}
                        </p>
                      </div>
                      <p className="font-body text-[12px] font-semibold leading-snug text-[#5c4030]">
                        wants to match in{" "}
                        <span className="font-bold text-[#3d2914]">{queueOpponent.category.name}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        disabled={queueLoading}
                        onClick={skipQueueOpponent}
                        className="coc-challenge-btn-label relative w-[76px] rounded-md py-2.5 text-xs font-bold active:translate-y-[3px] transition-transform duration-75 disabled:opacity-50"
                        style={{
                          background: "linear-gradient(180deg, #ffb347 0%, #ff7b2e 45%, #e84a1a 100%)",
                          border: "px solid #2a1608",
                          boxShadow:
                            "0 2px 0 #8b2e0a, 0 8px 14px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.45)",
                        }}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        disabled={queueLoading}
                        onClick={startQueueBattle}
                        className="coc-challenge-btn-label relative w-[76px] rounded-md py-2.5 text-xs font-bold active:translate-y-[3px] transition-transform duration-75 disabled:opacity-50"
                        style={{
                          background: "linear-gradient(180deg, #b8f04a 0%, #7ed321 45%, #4a9e12 100%)",
                          border: "px solid #2a1608",
                          boxShadow:
                            "0 2px 0 #2d5a0a, 0 8px 14px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.45)",
                        }}
                      >
                        {queueLoading ? "…" : "Battle"}
                      </button>
                    </div>
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
                    <CategoryIcon
                      category={cat}
                      size={64}
                      style="fluency"
                      className="h-10 w-10 object-contain"
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

      <LeagueModal isOpen={leagueModalOpen} onClose={() => setLeagueModalOpen(false)} currentXp={user?.xp || 0} />
    </div>
  );
};

export default HomeLobby;
