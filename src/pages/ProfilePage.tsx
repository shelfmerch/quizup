import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Globe2,
  Loader2,
  MessageCircle,
  Search,
  Settings,
  Swords,
  Trophy,
  XCircle,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import Icons8Icon, { getCategoryIconSlug } from "@/components/Icons8Icon";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_ACHIEVEMENTS, MOCK_CATEGORIES, MOCK_MATCH_HISTORY } from "@/data/mock-data";
import { resolveMediaUrl } from "@/config/env";
import { fetchFollowedCategories, fetchPublicCategories } from "@/services/categoryService";
import { getSocket } from "@/services/socketService";
import { profileService } from "@/services/profileService";
import { Category, MatchFoundPayload, MatchHistoryEntry, Profile } from "@/types";

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

const TILE_COLORS = ["#f65357", "#1fb7c9", "#ffca32", "#f65357", "#8d65e7", "#15b78f"];

function getLeagueFromXp(xpRaw: unknown) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? xpRaw : 0;
  for (const league of LEAGUES) {
    if (xp >= league.minXpInclusive) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

function playerRankLabel(level: number) {
  if (level <= 2) return "Beginner";
  if (level <= 5) return "Rising star";
  if (level <= 12) return "Challenger";
  return "Veteran";
}

const TopicTile: React.FC<{ category: Category; index: number; onClick: () => void }> = ({ category, index, onClick }) => {
  const { slug, fallback } = getCategoryIconSlug(category.name);

  return (
    <button type="button" onClick={onClick} className="w-[74px] shrink-0 text-center">
      <span
        className="quizup-topic-tile mx-auto flex h-14 w-14 rounded-lg"
        style={{ backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }}
      >
        <Icons8Icon name={slug} fallback={fallback} size={64} style="fluency" className="h-11 w-11 object-contain" alt="" />
      </span>
      <span className="mt-1 block min-h-[24px] text-[10px] font-black leading-[11px] text-[#343434] line-clamp-2">
        {category.name}
      </span>
      <span className="block text-[8px] font-black uppercase tracking-wide text-zinc-400">
        LVL {Math.max(1, Math.ceil((category.questionCount || 10) / 120))}
      </span>
    </button>
  );
};

const HistoryBubble: React.FC<{ match: MatchHistoryEntry; index: number }> = ({ match, index }) => {
  const isVictory = match.result === "win";
  const isDefeat = match.result === "loss";
  const resultColor = isVictory ? "#15b78f" : isDefeat ? "#f65357" : "#8d8d8d";
  const resultLabel = isVictory ? "Victory" : isDefeat ? "Defeat" : "Draw";
  const ResultIcon = isVictory ? Trophy : isDefeat ? XCircle : CheckCircle2;
  const badgeBg = isVictory ? "#15b78f" : isDefeat ? "#f65357" : "#8d8d8d";

  return (
    <div className="relative w-[76px] shrink-0 text-center">
      <span
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-[3px] bg-white shadow-md"
        style={{ borderColor: resultColor }}
      >
        <img
          src={resolveMediaUrl(match.opponentAvatar, `https://api.dicebear.com/7.x/avataaars/svg?seed=${match.opponentName}`)}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
        />
      </span>
      <span
        className="absolute right-1 top-8 flex h-6 w-6 items-center justify-center rounded-md text-white shadow"
        style={{ backgroundColor: badgeBg }}
      >
        <ResultIcon className="h-3.5 w-3.5" />
      </span>
      {/* <p className="mt-2 rounded-full px-1 py-0.5 text-[8px] font-black uppercase tracking-wide text-white" style={{ backgroundColor: resultColor }}>
        {resultLabel}
      </p> */}
      <p className="mt-1 truncate text-[9px] font-black text-[#444]">{match.opponentName}</p>
      <p className="text-[8px] font-bold uppercase" style={{ color: resultColor }}>
        {match.playerScore}-{match.opponentScore}
      </p>
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const isOwnProfile = !userId || userId === user?.id;
  const targetId = isOwnProfile ? user?.id : userId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [challengeSending, setChallengeSending] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [followedTopics, setFollowedTopics] = useState<Category[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    if (!targetId && !user) return;
    try {
      const data = await profileService.getProfile(targetId ?? "me");
      setProfile(data);
      if (!isOwnProfile) {
        const following = data.isFollowing !== undefined ? data.isFollowing : await profileService.checkIsFollowing(data.id);
        setIsFollowing(following);
      }
    } catch {
      if (isOwnProfile && user) setProfile(user);
    }
  }, [isOwnProfile, targetId, user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCategories()
      .then((list) => {
        if (!cancelled) setAllCategories(list);
      })
      .catch(() => {
        if (!cancelled) setAllCategories([]);
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
  }, [targetId]);

  useEffect(() => {
    if (!targetId) {
      setRecentMatches(MOCK_MATCH_HISTORY.slice(0, 5));
      return;
    }

    let cancelled = false;
    profileService
      .getMatchHistory(targetId, 5)
      .then((rows) => {
        if (!cancelled) setRecentMatches(rows.length ? rows : MOCK_MATCH_HISTORY.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setRecentMatches(MOCK_MATCH_HISTORY.slice(0, 5));
      });
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  useEffect(() => {
    if (!user?.id) return;
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onMatchFound = (p: MatchFoundPayload) => {
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

    socket.on("match_found", onMatchFound);
    return () => {
      socket.off("match_found", onMatchFound);
    };
  }, [navigate, user?.avatarUrl, user?.id, user?.level, user?.username]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwnProfile) return;
    if (!file.type.startsWith("image/")) {
      e.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      const updated = await profileService.uploadAvatar(file);
      setProfile(updated);
      await refreshUser();
    } catch (err) {
      console.error("Failed to upload avatar", err);
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await profileService.unfollowUser(profile.id);
        setIsFollowing(false);
        setProfile((prev) => (prev ? { ...prev, followers: Math.max(0, prev.followers - 1) } : prev));
      } else {
        await profileService.followUser(profile.id);
        setIsFollowing(true);
        setProfile((prev) => (prev ? { ...prev, followers: prev.followers + 1 } : prev));
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const ensureCategoriesLoaded = useCallback(async () => {
    if (allCategories.length > 0 || categoriesLoading) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      setAllCategories(await fetchPublicCategories());
    } catch {
      setCategoriesError("Could not load topics");
    } finally {
      setCategoriesLoading(false);
    }
  }, [allCategories.length, categoriesLoading]);

  const handleChallenge = () => {
    if (!profile || isOwnProfile) return;
    if (!user?.id) {
      navigate("/login");
      return;
    }
    setChallengeStatus(null);
    setChallengeModalOpen(true);
    void ensureCategoriesLoaded();
  };

  const sendChallengeForCategory = async (categoryIdRaw: string) => {
    if (!profile || !user?.id) return;
    const categoryId = (categoryIdRaw || profile.favoriteCategory || "science").toString().trim() || "science";
    setChallengeStatus(null);
    setChallengeSending(true);
    try {
      getSocket().emit("challenge:send", { toUserId: profile.id, categoryId });
      setChallengeStatus("Challenge sent");
      toast.success("Challenge sent", { position: "top-center" });
      setChallengeModalOpen(false);
    } catch (err) {
      setChallengeStatus(err instanceof Error ? err.message : "Could not send challenge");
    } finally {
      setChallengeSending(false);
    }
  };

  const p = profile ?? (isOwnProfile ? user : null);
  if (!p) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  const league = getLeagueFromXp(p.xp);
  const avatarSrc = resolveMediaUrl(
    p.avatarUrl,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.username)}`
  );
  const displayAchievements = MOCK_ACHIEVEMENTS.map((mockAch) => {
    const unlocked = p.achievements?.find((a) => a.id === mockAch.id);
    return { ...mockAch, isUnlocked: !!unlocked, unlockedAt: unlocked?.unlockedAt };
  });
  const topicsToShow = (followedTopics.length ? followedTopics : allCategories.length ? allCategories : MOCK_CATEGORIES).slice(0, 4);

  return (
    <div className="quizup-app pb-20">
      <div className="quizup-topbar">
        <button onClick={isOwnProfile ? () => navigate("/settings") : () => navigate(-1)} aria-label={isOwnProfile ? "Settings" : "Back"}>
          {isOwnProfile ? <Settings className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <h1 className="font-display text-[17px] font-black">QuizUp</h1>
        <div className="flex items-center gap-4">
          <button aria-label="Search"><Search className="h-5 w-5" /></button>
          <button onClick={() => !isOwnProfile && navigate(`/chat/${p.id}`)} aria-label="Chat">
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      <section className="relative overflow-hidden bg-[#222] text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: "url('/images/default_banner.png')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/70" />
        <div className="relative px-6 pb-5 pt-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => isOwnProfile && fileInputRef.current?.click()}
                className={`h-24 w-24 overflow-hidden rounded-full border-[4px] border-white bg-white shadow-xl ${isOwnProfile ? "cursor-pointer" : ""}`}
                aria-label={isOwnProfile ? "Change profile photo" : undefined}
              >
                <img src={avatarSrc} alt="" className={`h-full w-full object-cover ${uploadingAvatar ? "opacity-50" : ""}`} />
              </button>
              {isOwnProfile && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#f65357] shadow-lg"
                    aria-label="Change profile photo"
                  >
                    {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleAvatarSelect} accept="image/*" className="hidden" />
                </>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display text-2xl font-black leading-tight drop-shadow">
                  {p.displayName || p.username}
                </h2>
                <span className="h-2 w-2 rounded-full bg-[#20c997]" />
                <span className="ml-auto font-display text-2xl font-light text-white/85">{p.level}</span>
              </div>
              {/* <p className="mt-0.5 text-sm font-semibold text-white/75">{playerRankLabel(p.level)}</p>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-white/85">
                <Globe2 className="h-3.5 w-3.5" />
                {p.country || "Country not set"}
              </p> */}
              <div className="mt-3 flex items-center gap-2">
                <img src={league.badgeUrl} alt="" className="h-8 w-8 object-contain drop-shadow" />
                <span className="text-xs font-black uppercase tracking-wide text-white/85">{league.name}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-white/25 border-t border-white/10 pt-3 text-center">
            {[
              { label: "Games", value: p.totalMatches ?? 0 },
              { label: "Followers", value: p.followers ?? 0 },
              { label: "Following", value: p.following ?? 0 },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/45">{stat.label}</p>
                <p className="font-display text-4xl font-light leading-none drop-shadow">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!isOwnProfile && (
        <div className="quizup-section px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-black shadow-sm transition active:scale-[0.98] ${
                isFollowing
                  ? "border border-[#dddddd] bg-white text-slate-700"
                  : "bg-[#f65357] text-white"
              }`}
            >
              {followLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                <UserCheck className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button
              onClick={handleChallenge}
              disabled={challengeSending}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#080808] text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
            >
              {challengeSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              Challenge
            </button>
          </div>
          {challengeStatus && (
            <p className="pt-2 text-center text-xs font-bold text-slate-500">{challengeStatus}</p>
          )}
        </div>
      )}

      <section className="quizup-section px-4 py-4">
        <h3 className="quizup-section-title mb-3">Followed Topics</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {topicsToShow.map((cat, index) => (
            <TopicTile key={cat.id} category={cat} index={index} onClick={() => navigate(`/category/${cat.id}`)} />
          ))}
        </div>
      </section>

      <section className="quizup-section mt-2 px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="quizup-section-title">Game History</h3>
          <button className="quizup-see-all" onClick={() => navigate("/history")}>See all</button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {recentMatches.slice(0, 5).map((match, index) => (
            <HistoryBubble key={match.matchId} match={match} index={index} />
          ))}
        </div>
      </section>

      <section className="quizup-section mt-2 px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="quizup-section-title">Achievements</h3>
          <span className="text-[10px] font-black uppercase text-zinc-400">
            {displayAchievements.filter((a) => a.isUnlocked).length}/{displayAchievements.length}
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {displayAchievements.slice(0, 6).map((a) => (
            <div key={a.id} className={`w-[58px] shrink-0 text-center ${!a.isUnlocked ? "opacity-35 grayscale" : ""}`} title={a.description}>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white text-xl shadow-md border border-[#dddddd]">
                {a.icon}
              </span>
              <p className="mt-1 line-clamp-2 text-[9px] font-black leading-[10px] text-[#444]">{a.name}</p>
            </div>
          ))}
        </div>
      </section>

      {isOwnProfile && (
        <div className="grid grid-cols-2 gap-2 px-4 py-4">
          <button onClick={() => navigate("/categories")} className="h-11 rounded-lg bg-[#f65357] text-sm font-black text-white shadow-md">
            Play Now
          </button>
          <button onClick={async () => { await logout(); navigate("/"); }} className="h-11 rounded-lg border border-[#dddddd] bg-white text-sm font-black text-[#f65357] shadow-sm">
            Log Out
          </button>
        </div>
      )}

      {challengeModalOpen && !isOwnProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Challenge</p>
                <p className="text-[15px] font-bold text-slate-900 truncate mt-0.5">
                  {p.displayName || p.username}
                </p>
              </div>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                onClick={() => setChallengeModalOpen(false)}
              >
                x
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
              {categoriesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              )}

              {categoriesError && !categoriesLoading && (
                <p className="text-sm font-medium text-quizup-red py-4 text-center">{categoriesError}</p>
              )}

              {!categoriesLoading && !categoriesError && allCategories.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No topics available right now.
                </p>
              )}

              {!categoriesLoading &&
                allCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={challengeSending}
                    onClick={() => sendChallengeForCategory(cat.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm text-left hover:border-quizup-purple transition-colors disabled:opacity-60"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">
                      <span>{cat.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-slate-900 truncate">{cat.name}</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {cat.questionCount} questions
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
