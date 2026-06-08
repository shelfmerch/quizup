import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getLeagueFromXp, leagueBadgeSrc } from "@/lib/progression";
import { useChatUnread } from "@/hooks/useChatUnread";
import { toast } from "sonner";
import { shareAppInvite } from "@/lib/challengeShare";

interface IncomingChallenge {
  id: string;
  from: { userId: string; username: string; avatarUrl: string };
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
}

interface SearchingQueueUser {
  userId: string;
  username: string;
  avatarUrl: string;
  level: number;
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
}

const TILE_COLORS = ["#f65357", "#0dbf9d", "#20b7d5", "#ffc233", "#ff8d2c", "#8d65e7"];

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

const ChallengeBattleIcon: React.FC<{ variant?: "default" | "muted" }> = ({ variant = "default" }) => (
  <div
    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 shadow-inner ${
      variant === "muted"
        ? "border-slate-200 bg-slate-50 text-slate-400"
        : "border-[#c4a574] bg-gradient-to-br from-amber-50 to-amber-100 text-[#b45309]"
    }`}
  >
    <Swords className="h-7 w-7" strokeWidth={2.25} />
  </div>
);

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

  // Real matchmaking queue (players on Find Match waiting for opponents)
  const [searchingUsers, setSearchingUsers] = useState<SearchingQueueUser[]>([]);
  const [skippedQueueIds, setSkippedQueueIds] = useState<Set<string>>(() => new Set());
  const [queueRefreshing, setQueueRefreshing] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [isQueueTransitioning, setIsQueueTransitioning] = useState(false);

  const allTopics = useMemo(() => mergeTopics(apiCategories), [apiCategories]);
  const tournaments = useMemo(() => allTopics.slice(0, 5), [allTopics]);
  const dailyChallenges = useMemo(() => allTopics.slice(5, 9), [allTopics]);
  const followed = followedTopics.length ? followedTopics.slice(0, 5) : allTopics.slice(9, 14);

  const visibleQueueUsers = useMemo(
    () => searchingUsers.filter((u) => !skippedQueueIds.has(u.userId)),
    [searchingUsers, skippedQueueIds]
  );

  const queueOpponent = useMemo(() => {
    const u = visibleQueueUsers[0];
    if (!u) return null;
    const category =
      allTopics.find((t) => t.id === u.categoryId) ||
      ({
        id: u.categoryId,
        name: u.categoryName,
        icon: u.categoryIcon || "🎯",
        color: "0 0% 50%",
        questionCount: 0,
        description: "",
      } satisfies Category);
    return {
      user: {
        userId: u.userId,
        username: u.username,
        avatarUrl: u.avatarUrl,
        level: u.level,
      },
      category,
    };
  }, [visibleQueueUsers, allTopics]);

  // Drop skip marks for players who left the queue; keep marks for players still waiting
  useEffect(() => {
    const activeIds = new Set(searchingUsers.map((u) => u.userId));
    setSkippedQueueIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (activeIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [searchingUsers]);

  const refreshSearchingQueue = useCallback(() => {
    try {
      getSocket().emit("queue:get_searching");
    } catch {
      setSearchingUsers([]);
      setQueueRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id || incomingChallenge) return;
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      setQueueRefreshing(false);
      return;
    }

    const onSearchingUsers = ({ users }: { users?: SearchingQueueUser[] }) => {
      const list = Array.isArray(users) ? users : [];
      setSearchingUsers(list);
      setQueueRefreshing(false);
      setIsQueueTransitioning(false);
    };

    socket.on("queue:searching_users", onSearchingUsers);
    refreshSearchingQueue();

    const interval = setInterval(refreshSearchingQueue, 4000);

    return () => {
      clearInterval(interval);
      socket.off("queue:searching_users", onSearchingUsers);
    };
  }, [user?.id, incomingChallenge, refreshSearchingQueue]);

  const skipQueueOpponent = () => {
    if (!queueOpponent) return;
    setIsQueueTransitioning(true);
    setSkippedQueueIds((prev) => new Set(prev).add(queueOpponent.user.userId));
    setTimeout(() => setIsQueueTransitioning(false), 250);
  };

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

    const onChallengeError = ({ message }: { message?: string }) => {
      setQueueLoading(false);
      setChallengeResponding(false);
      if (message) toast.error(message, { position: "top-center" });
    };

    socket.on("challenge:received", onReceived);
    socket.on("challenge:cancelled", onCancelled);
    socket.on("challenge:error", onChallengeError);
    socket.on("match_found", onMatchFound);

    return () => {
      socket.off("challenge:received", onReceived);
      socket.off("challenge:cancelled", onCancelled);
      socket.off("challenge:error", onChallengeError);
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

                  <div className="flex flex-row items-center gap-3">
                    {/* <ChallengeBattleIcon /> */}

                    <div className="flex min-w-0 flex-1 flex-row items-center gap-2.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#c4a574] bg-white/60 shadow-[inset_0_2px_6px_rgba(61,41,20,0.08)]">
                        <CategoryIcon
                          category={
                            allTopics.find((t) => t.id === incomingChallenge.categoryId) || {
                              name: incomingChallenge.categoryName,
                              icon: incomingChallenge.categoryIcon,
                            }
                          }
                          size={48}
                          style="fluency"
                          className="h-9 w-9 object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <img
                            src={resolveMediaUrl(
                              incomingChallenge.from.avatarUrl,
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(incomingChallenge.from.username)}`
                            )}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-full border-2 border-[#999999] object-cover shadow-sm"
                          />
                          <p className="truncate font-display text-[14px] font-black text-[#3d2914]">
                            {incomingChallenge.from.username}
                          </p>
                        </div>
                        <p className="mt-0.5 font-body text-[11px] font-semibold leading-snug text-[#5c4030] flex flex-wrap items-center gap-1">
                          <span>challenges you in</span>
                          <span className="font-bold text-[#3d2914]">{incomingChallenge.categoryName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row items-center gap-2">
                      <button
                        type="button"
                        disabled={challengeResponding}
                        onClick={() => respondToChallenge("reject")}
                        className="coc-challenge-btn-label relative rounded-md px-3 py-2 text-[10px] font-bold active:translate-y-[2px] transition-transform duration-75 disabled:opacity-50 whitespace-nowrap"
                        style={{
                          background: "linear-gradient(180deg, #ffb347 0%, #ff7b2e 45%, #e84a1a 100%)",
                          boxShadow:
                            "0 2px 0 #8b2e0a, 0 4px 10px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.45)",
                        }}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={challengeResponding}
                        onClick={() => respondToChallenge("accept")}
                        className="coc-challenge-btn-label relative rounded-md px-3 py-2 text-[10px] font-bold active:translate-y-[2px] transition-transform duration-75 disabled:opacity-50 whitespace-nowrap"
                        style={{
                          background: "linear-gradient(180deg, #b8f04a 0%, #7ed321 45%, #4a9e12 100%)",
                          boxShadow:
                            "0 2px 0 #2d5a0a, 0 4px 10px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.45)",
                        }}
                      >
                        {challengeResponding ? "…" : "Accept"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="relative mx-auto max-w-lg"
                style={{
                  animation: "challengeSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
                }}
              >
                <div
                  className={`relative rounded-lg px-3 pb-3 pt-3.5 transition-all duration-300 ${
                    isQueueTransitioning ? "opacity-0 transform translate-y-2 scale-95" : "opacity-100 transform translate-y-0 scale-100"
                  }`}
                  style={{
                    background: "linear-gradient(180deg, #ffffffff 0%, #fefefe 100%)",
                    border: "2px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
                  }}
                >
                  {queueRefreshing && !queueOpponent ? (
                    <div className="flex flex-row items-center gap-3 py-2">
                      <ChallengeBattleIcon variant="muted" />
                      <div className="flex flex-1 items-center justify-center py-3">
                        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                      </div>
                    </div>
                  ) : queueOpponent ? (
                    <div className="flex flex-row items-center gap-3">
                      {/* <ChallengeBattleIcon /> */}

                      {/* <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#c4a574] bg-white/60 shadow-[inset_0_2px_6px_rgba(61,41,20,0.08)]">
                        <CategoryIcon
                          category={
                            allTopics.find((t) => t.id === queueOpponent.categoryId) || {
                              name: queueOpponent.categoryName,
                              icon: queueOpponent.categoryIcon,
                            }
                          }
                          size={48}
                          style="fluency"
                          className="h-9 w-9 object-contain"
                        />
                      </div> */}

                      <div className="relative min-w-0 flex-1">
                        {/* <div className="absolute top-0 right-0 flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-wider text-green-600">In queue</span>
                        </div> */}

                        <div className="flex flex-row items-center gap-2.5 pr-16">
                          <div className="relative shrink-0">
                            <img
                              src={resolveMediaUrl(
                                queueOpponent.user.avatarUrl,
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(queueOpponent.user.username)}`
                              )}
                              alt=""
                              className="h-12 w-12 rounded-full border-2 border-[#ffb347] object-cover bg-amber-50/50 shadow-sm"
                            />
                            <span className="absolute -bottom-1 -right-1 rounded-full border border-white bg-amber-500 px-1 py-0.5 text-[8px] font-black text-white shadow">
                              {queueOpponent.user.level}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate font-display text-[14px] font-extrabold text-[#3d2914]">
                              {queueOpponent.user.username}
                            </p>
                            <p className="mt-0.5 flex flex-row flex-wrap items-center gap-1 font-body text-[11px] font-semibold leading-snug text-[#718096]">
                              {/* <span>Searching in</span> */}
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                <CategoryIcon
                                  category={queueOpponent.category}
                                  size={24}
                                  style="fluency"
                                  className="inline-block h-7 w-7 object-contain"
                                />
                                {queueOpponent.category.name}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-row items-center gap-2">
                        <button
                          type="button"
                          disabled={queueLoading}
                          onClick={skipQueueOpponent}
                          className="relative rounded-md px-3 py-2 text-center text-[10px] font-black tracking-wide text-white transition-all duration-75 active:translate-y-[2px] disabled:opacity-50 whitespace-nowrap"
                          style={{
                            background: "linear-gradient(180deg, #ffb347 0%, #ff7b2e 45%, #e84a1a 100%)",
                            boxShadow: "0 2px 0 #8b2e0a, 0 4px 6px rgba(0,0,0,0.15), inset 0 1.5px 0 rgba(255,255,255,0.4)",
                            textShadow: "0 1px 0 #2a1608",
                          }}
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          disabled={queueLoading}
                          onClick={startQueueBattle}
                          className="relative flex items-center justify-center gap-1 rounded-md px-3 py-2 text-center text-[10px] font-black tracking-wide text-white transition-all duration-75 active:translate-y-[2px] disabled:opacity-50 whitespace-nowrap"
                          style={{
                            background: "linear-gradient(180deg, #b8f04a 0%, #7ed321 45%, #4a9e12 100%)",
                            boxShadow: "0 2px 0 #2d5a0a, 0 4px 6px rgba(0,0,0,0.15), inset 0 1.5px 0 rgba(255,255,255,0.4)",
                            textShadow: "0 1px 0 #2d5a0a",
                          }}
                        >
                          {queueLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Battle"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-row items-center gap-3 py-1">
                      <ChallengeBattleIcon variant="muted" />
                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-display text-[13px] font-bold text-[#3d2914]">
                          No one is searching right now
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold leading-snug text-[#718096]">
                          Players show up when someone uses Find Match.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/categories")}
                        className="shrink-0 rounded-md px-3 py-2 text-[10px] font-black text-white whitespace-nowrap"
                        style={{
                          background: "linear-gradient(180deg, #b8f04a 0%, #7ed321 45%, #4a9e12 100%)",
                          boxShadow: "0 2px 0 #2d5a0a, inset 0 1.5px 0 rgba(255,255,255,0.4)",
                        }}
                      >
                        Find match
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Section>

          <Section title="Unlock Community">
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
              <button
                type="button"
                onClick={() => {
                  void shareAppInvite(user?.username).then(() => {
                    toast.success("Invite link ready to share!", { position: "top-center" });
                  }).catch(() => {
                    toast.error("Could not share invite", { position: "top-center" });
                  });
                }}
                className="w-[58px] shrink-0 text-center"
              >
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

      <LeagueModal
        isOpen={leagueModalOpen}
        onClose={() => setLeagueModalOpen(false)}
        currentXp={user?.xp ?? 0}
      />
    </div>
  );
};

export default HomeLobby;
