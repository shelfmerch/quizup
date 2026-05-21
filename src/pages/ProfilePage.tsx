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
  Lock,
  Calendar,
  Share2,
  Sparkles,
  Award,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { CategoryIcon } from "@/components/CategoryIcon";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { MOCK_ACHIEVEMENTS, MOCK_CATEGORIES, MOCK_MATCH_HISTORY } from "@/data/mock-data";
import { resolveMediaUrl } from "@/config/env";
import { fetchFollowedCategories, fetchPublicCategories } from "@/services/categoryService";
import { getSocket } from "@/services/socketService";
import { profileService } from "@/services/profileService";
import { Category, MatchFoundPayload, MatchHistoryEntry, Profile, ProfileFollowUser } from "@/types";
import { LeagueModal } from "@/components/LeagueModal";

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

const TILE_COLORS = ["#f65357", "#1fb7c9", "#ffca32", "#f65357", "#8d65e7", "#15b78f"];

function getLeagueFromXp(xpRaw: unknown) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
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

interface RarityTier {
  name: string;
  color: string;
  bgGradient: string;
  glowClass: string;
  textClass: string;
  bgSolid: string;
}

const ACHIEVEMENT_TIERS: Record<string, RarityTier> = {
  legendary: {
    name: "Legendary",
    color: "#eab308",
    bgGradient: "from-amber-400 via-yellow-500 to-amber-600",
    glowClass: "shadow-[0_0_15px_rgba(234,179,8,0.45)] border-amber-400/80 hover:shadow-[0_0_25px_rgba(234,179,8,0.7)]",
    textClass: "text-amber-500 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-amber-500",
  },
  epic: {
    name: "Epic",
    color: "#a855f7",
    bgGradient: "from-fuchsia-500 via-purple-600 to-indigo-600",
    glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.45)] border-purple-400/80 hover:shadow-[0_0_25px_rgba(168,85,247,0.7)]",
    textClass: "text-purple-500 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-purple-500",
  },
  rare: {
    name: "Rare",
    color: "#3b82f6",
    bgGradient: "from-blue-400 via-indigo-500 to-cyan-500",
    glowClass: "shadow-[0_0_12px_rgba(59,130,246,0.35)] border-blue-400/80 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)]",
    textClass: "text-blue-500 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-blue-500",
  },
  common: {
    name: "Common",
    color: "#14b8a6",
    bgGradient: "from-teal-400 to-emerald-500",
    glowClass: "shadow-[0_0_10px_rgba(20,184,166,0.25)] border-teal-400/80 hover:shadow-[0_0_18px_rgba(20,184,166,0.5)]",
    textClass: "text-teal-600 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-teal-500",
  },
};

const ACHIEVEMENT_RARITY_MAP: Record<string, keyof typeof ACHIEVEMENT_TIERS> = {
  a1: "common",
  a2: "rare",
  a3: "epic",
  a4: "legendary",
  a5: "rare",
  a6: "common",
  a7: "epic",
  a8: "legendary",
  a9: "legendary",
};

const TopicTile: React.FC<{ category: Category; index: number; onClick: () => void }> = ({ category, index, onClick }) => {
  return (
    <button type="button" onClick={onClick} className="w-[74px] shrink-0 text-center">
      <span
        className="quizup-topic-tile mx-auto flex h-14 w-14 rounded-lg"
        style={{ backgroundColor: TILE_COLORS[index % TILE_COLORS.length] }}
      >
        <CategoryIcon category={category} size={64} style="fluency" className="h-11 w-11 object-contain" />
      </span>
      <span className="mt-1 block min-h-[24px] text-[10px] font-black leading-[11px] text-[#343434] line-clamp-2">
        {category.name}
      </span>
    </button>
  );
};

const AchievementBadge: React.FC<{ src: string; icon: string; alt: string; className?: string; isUnlocked?: boolean }> = ({ src, icon, alt, className = "h-24 w-24", isUnlocked = true }) => {
  const [errored, setErrored] = useState(false);
  if (errored || !src) {
    return <span className="text-2xl leading-none filter drop-shadow-sm" aria-label={alt}>{icon}</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain transition-transform duration-300 filter drop-shadow-sm ${isUnlocked ? "" : "grayscale opacity-70"}`}
      onError={() => setErrored(true)}
    />
  );
};

const HistoryBubble: React.FC<{ match: MatchHistoryEntry; index: number }> = ({ match, index }) => {
  const isVictory = match.result === "win";
  const isDefeat = match.result === "loss";
  const resultColor = isVictory ? "#15b78f" : isDefeat ? "#f65357" : "#8d8d8d";
  const resultLabel = isVictory ? <img src="/images/victory.png" alt="" /> : isDefeat ? <img src="/images/defeat.png" alt="" /> : <img src="/images/draw.png" alt="" />;
  const ResultIcon = isVictory ? Trophy : isDefeat ? XCircle : CheckCircle2;
  const badgeBg = isVictory ? "#15b78f" : isDefeat ? "#f65357" : "#8d8d8d";

  return (
    <div className="relative w-[76px] shrink-0 text-center">
      <span
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-[1px] bg-white shadow-md"
        // style={{ borderColor: resultColor }}
      >
        <img
          src={resolveMediaUrl(match.opponentAvatar, `https://api.dicebear.com/7.x/avataaars/svg?seed=${match.opponentName}`)}
          alt=""
          className="h-12 w-12 rounded-full object-cover"
        />
      </span>
      {/* <span
        className="absolute right-1 top-8 flex h-6 w-6 items-center justify-center rounded-md text-white shadow"
        style={{ backgroundColor: badgeBg }}
      >
        <ResultIcon className="h-3.5 w-3.5" />
      </span> */}
      {/* <p className="mt-2 rounded-full px-1 py-0.5 text-[8px] font-black uppercase tracking-wide text-white" style={{ backgroundColor: resultColor }}>
        {resultLabel}
      </p> */}
      <div className="-mt-5 flex justify-center">
        <span className="flex items-center justify-center leading-none">
          {resultLabel}
        </span>
      </div>
      {/* <p className="-mt-3 truncate text-[9px] font-black text-[#444]">{match.opponentName}</p>
      <p className="text-[8px] font-bold uppercase" style={{ color: resultColor }}>
        {match.playerScore}-{match.opponentScore}
      </p> */}
    </div>
  );
};

const FollowerTile: React.FC<{ person: ProfileFollowUser; onSelect: (id: string) => void }> = ({ person, onSelect }) => {
  const src = resolveMediaUrl(
    person.avatarUrl,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.username)}`
  );
  const label = person.displayName || person.username;
  return (
    <button type="button" onClick={() => onSelect(person.id)} className="w-[76px] shrink-0 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#dddddd] bg-white shadow-md">
        <img src={src} alt="" className="h-full w-full object-cover" />
      </span>
      <p className="mt-1 truncate text-[9px] font-black text-[#444]">{label}</p>
    </button>
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
  const [followers, setFollowers] = useState<ProfileFollowUser[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followersError, setFollowersError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<typeof MOCK_ACHIEVEMENTS[number] | null>(null);
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
    const ownerId = targetId || userId || profile?.id;
    if (!ownerId) {
      setFollowers([]);
      setFollowersLoading(false);
      setFollowersError(null);
      return;
    }

    let cancelled = false;
    setFollowersLoading(true);
    setFollowersError(null);
    profileService
      .getFollowers(ownerId)
      .then((rows) => {
        if (!cancelled) {
          setFollowers(rows);
          setFollowersLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFollowers([]);
          setFollowersError("Could not load followers");
          setFollowersLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [targetId, userId, profile?.id, isFollowing]);

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
                {/* <span className="ml-auto font-display text-2xl font-light text-white/85">{p.level}</span> */}
              </div>
              {/* <p className="mt-0.5 text-sm font-semibold text-white/75">{playerRankLabel(p.level)}</p>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-white/85">
                <Globe2 className="h-3.5 w-3.5" />
                {p.country || "Country not set"}
              </p> */}
              <div 
                className="mt-3 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setLeagueModalOpen(true)}
              >
                <img src={league.badgeUrl} alt="" className="h-8 w-8 object-contain drop-shadow" />
                <span className="text-xs font-black uppercase tracking-wide text-white/85">{league.name}</span>
                {/* <span className="ml-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white/90">{typeof p.xp === "number" ? p.xp.toLocaleString() : 0} XP</span> */}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 divide-x divide-white/25 border-t border-white/10 pt-3 text-center">
            {[
              // { label: "Games", value: p.totalMatches ?? 0 },
              { label: "Followers", value: p.followers ?? 0 },
              { label: "XP", value: p.xp ?? 0 },
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
              className={`flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-black shadow-sm transition active:scale-[0.98] ${isFollowing
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

      <section className="quizup-section mt-2 px-4 py-4">
        <style>{`
          @keyframes shimmer-sweep {
            0% { transform: translateX(-150%) skewX(-15deg); }
            50% { transform: translateX(150%) skewX(-15deg); }
            100% { transform: translateX(150%) skewX(-15deg); }
          }
          .animate-shimmer-sweep {
            position: relative;
            overflow: hidden;
          }
          .animate-shimmer-sweep::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.45),
              transparent
            );
            transform: translateX(-100%);
            animation: shimmer-sweep 2.5s infinite;
          }
          @keyframes float-gentle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          .animate-float-gentle {
            animation: float-gentle 4s ease-in-out infinite;
          }
        `}</style>
        
        <div className="mb-3 flex items-center justify-between">
          <h3 className="quizup-section-title">Achievements</h3>
          <button className="quizup-see-all" onClick={() => navigate("/achievements")}>More</button>
        </div>

        {/* Completion Progress Bar Card */}
        {/* {(() => {
          const unlockedCount = displayAchievements.filter((a) => a.isUnlocked).length;
          const totalCount = displayAchievements.length;
          const percentUnlocked = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
          
          return (
            <div className="mb-4 bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-inner">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Unlock Progress</span>
                <span className="text-[10px] font-black text-slate-800 bg-white px-2 py-0.5 rounded-full shadow-sm border border-slate-100/80 flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-amber-500" />
                  {unlockedCount} / {totalCount}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden relative">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 via-purple-500 to-amber-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${percentUnlocked}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <p className="text-[9px] text-slate-400 font-extrabold uppercase">{percentUnlocked}% Completed</p>
                {percentUnlocked === 100 && (
                  <p className="text-[9px] text-emerald-500 font-black flex items-center gap-0.5 uppercase tracking-wide">
                    <Sparkles className="h-2.5 w-2.5 animate-pulse" /> Ultimate Master
                  </p>
                )}
              </div>
            </div>
          );
        })()} */}

        {/* Grid and Badges list */}
        <div className="flex gap-1 scrollbar-none">
          {displayAchievements.slice(0, 5).map((a) => {
            const rarityKey = ACHIEVEMENT_RARITY_MAP[a.id] || "common";
            const tier = ACHIEVEMENT_TIERS[rarityKey];
            
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAchievement(a)}
                className="group w-[82px] shrink-0 text-center flex flex-col items-center focus:outline-none"
              >
                <div 
                  className={`relative h-16 w-16 flex items-center justify-center rounded-2xl bg-white border-2 p-1.5 transition-all duration-300 ${
                    a.isUnlocked 
                      ? `bg-gradient-to-br ${tier.bgGradient} p-[2px] ${tier.glowClass} scale-100 hover:scale-110 hover:-rotate-2 active:scale-95 cursor-pointer`
                      : 'border-slate-200 opacity-40 bg-slate-50'
                  }`}
                >
                  {/* Badge Inner Frame */}
                  <div className={`h-full w-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden relative ${a.isUnlocked ? 'animate-shimmer-sweep' : ''}`}>
                    <AchievementBadge src={a.src} icon={a.icon} alt={a.name} className="h-16 w-16" isUnlocked={a.isUnlocked} />
                    
                    {/* Floating Glow Indicator Dot */}
                    {/* {a.isUnlocked && (
                      <span className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${tier.bgSolid} ring-1 ring-white animate-pulse`} />
                    )} */}
                  </div>

                  {/* Lock Symbol */}
                  {!a.isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 rounded-2xl backdrop-blur-[0.5px]">
                      <div className="bg-white/95 p-1 rounded-lg shadow-sm border border-slate-200">
                        <Lock className="h-3 w-3 text-slate-500" />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Achievement Name */}
                <p className={`mt-1.5 line-clamp-1 text-[9px] font-black leading-tight max-w-[76px] transition-colors ${
                  a.isUnlocked ? 'text-slate-800 group-hover:text-slate-950' : 'text-slate-400'
                }`}>
                  {a.name}
                </p>
                <span className={`text-[7px] font-black uppercase tracking-wider ${
                  a.isUnlocked ? tier.textClass : 'text-slate-400'
                }`}>
                  {tier.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Premium Interactive Modal */}
        {selectedAchievement && (() => {
          const a = selectedAchievement;
          const unlocked = p.achievements?.find((x) => x.id === a.id);
          const isUnlocked = !!unlocked;
          const unlockedAt = unlocked?.unlockedAt;
          const rarityKey = ACHIEVEMENT_RARITY_MAP[a.id] || "common";
          const tier = ACHIEVEMENT_TIERS[rarityKey];

          return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center backdrop-blur-md transition-all">
              {/* Modal Box */}
              <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative animate-slide-up">
                {/* Accent Banner */}
                <div className={`h-3 w-full bg-gradient-to-r ${tier.bgGradient}`} />
                
                {/* Close x */}
                <button
                  type="button"
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors z-10 shadow-sm"
                  onClick={() => setSelectedAchievement(null)}
                >
                  ✕
                </button>

                <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
                  {/* Glowing Frame */}
                  <div className={`relative h-28 w-28 flex items-center justify-center rounded-3xl bg-white border-[3px] p-2.5 shadow-xl transition-transform ${
                    isUnlocked 
                      ? `bg-gradient-to-br ${tier.bgGradient} ${tier.glowClass} animate-float-gentle`
                      : 'border-slate-200'
                  }`}>
                    <div className="h-full w-full rounded-[20px] bg-white flex items-center justify-center overflow-hidden relative shadow-inner">
                      <AchievementBadge src={a.src} icon={a.icon} alt={a.name} className="h-16 w-16" isUnlocked={isUnlocked} />
                      {isUnlocked && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none animate-shimmer-sweep" />
                      )}
                    </div>
                    
                    {/* Status Badge */}
                    <div className={`absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md ${
                      isUnlocked ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
                    }`}>
                      {isUnlocked ? <Sparkles className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                    </div>
                  </div>

                  {/* Title & Rarity */}
                  <div className="mt-6">
                    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black tracking-widest ${
                      isUnlocked 
                        ? `${tier.bgSolid} text-white`
                        : 'bg-slate-100 text-slate-500'
                    } uppercase mb-2 shadow-sm`}>
                      {tier.name} Achievement
                    </span>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">
                      {a.name}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-slate-600 font-semibold text-sm max-w-xs leading-relaxed">
                    {a.description}
                  </p>

                  <div className="w-full border-t border-slate-100 my-5" />

                  {/* Earned Status Info */}
                  <div className="w-full flex flex-col items-center">
                    {isUnlocked ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
                          <CheckCircle2 className="h-4 w-4" />
                          Unlocked!
                        </div>
                        {unlockedAt && (
                          <p className="text-xs text-slate-400 font-semibold mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Earned on {new Date(unlockedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold text-sm bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200">
                          <Lock className="h-4 w-4" />
                          Locked
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mt-1 max-w-[240px]">
                          Challenge yourself in battles to satisfy this requirement and claim this reward!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-full mt-6 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAchievement(null)}
                      className="h-11 rounded-xl border border-slate-200 text-slate-700 bg-white font-bold text-sm hover:bg-slate-50 transition active:scale-[0.98] shadow-sm"
                    >
                      Close
                    </button>
                    {isUnlocked ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: `Unlocked Achievement: ${a.name}!`,
                              text: `I just unlocked the "${a.name}" achievement in Quiz Blitz Arena! Can you beat my score?`,
                              url: window.location.href,
                            }).catch(console.error);
                          } else {
                            navigator.clipboard.writeText(`I just unlocked the "${a.name}" achievement in Quiz Blitz Arena!`);
                            toast.success("Copied share message to clipboard!");
                          }
                        }}
                        className="h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-md shadow-indigo-600/10"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAchievement(null);
                          navigate("/categories");
                        }}
                        className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-md shadow-slate-950/10"
                      >
                        <Swords className="h-4 w-4" />
                        Play Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      <section className="quizup-section mt-2 px-4 py-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="quizup-section-title">Followers</h3>
          <button className="quizup-see-all" onClick={() => navigate("/people")}>More</button>
          {/* <span className="text-[10px] font-black uppercase text-zinc-400">
            {followersLoading ? "…" : `${followers.length}`}
          </span> */}
        </div>
        {followersLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}
        {followersError && !followersLoading && (
          <p className="py-2 text-center text-xs font-bold text-zinc-500">{followersError}</p>
        )}
        {!followersLoading && !followersError && followers.length === 0 && (
          <p className="py-2 text-center text-xs font-bold text-zinc-400">No followers yet</p>
        )}
        {!followersLoading && !followersError && followers.length > 0 && (
          <div className="flex overflow-x-auto pb-1">
            {followers.slice(0, 5).map((person) => (
              <FollowerTile key={person.id} person={person} onSelect={(id) => navigate(`/profile/${id}`)} />
            ))}
          </div>
        )}
      </section>

      <section className="quizup-section px-4 py-4 mt-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="quizup-section-title mb-3">Followed Topics</h3>
        <button className="quizup-see-all" onClick={() => navigate("/all-categories")}>More</button>
      </div>
      <div className="flex gap-3 pb-1">
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
        <div className="flex gap-2">
          {recentMatches.slice(0, 5).map((match, index) => (
            <HistoryBubble key={match.matchId} match={match} index={index} />
          ))}
        </div>
      </section>

      {isOwnProfile && (
        <div className="grid grid-cols-2 gap-2 px-4 py-4">
          <button onClick={() => navigate("/categories")} className="h-11 rounded-lg bg-[#f65357] text-sm font-black text-white shadow-md">
            Play Now
          </button>
          <button onClick={async () => { await logout(); navigate("/"); }} className="h-11 rounded-lg border border-[#dddddd] bg-black text-sm font-black text-white shadow-sm">
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
      
      <LeagueModal isOpen={leagueModalOpen} onClose={() => setLeagueModalOpen(false)} currentXp={p.xp || 0} />

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
