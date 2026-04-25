import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { toast } from "@/components/ui/sonner";
import { Category, MatchFoundPayload, Profile } from "@/types";
import { MOCK_ACHIEVEMENTS } from "@/data/mock-data";
import { resolveMediaUrl } from "@/config/env";
import { Settings, LogOut, Search, ArrowLeft, UserPlus, UserCheck, MessageCircle, Loader2, Camera, Swords } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getSocket } from "@/services/socketService";
import { fetchPublicCategories } from "@/services/categoryService";

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

const LEAGUES: Array<{
  key: LeagueKey;
  name: string;
  minXpInclusive: number;
  badgeUrl: string;
}> = [
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

const ProfilePage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();

  // Is this the logged-in user's own profile?
  const isOwnProfile = !userId || userId === user?.id;
  const targetId = isOwnProfile ? (user?.id ?? "me") : userId!;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [challengeSending, setChallengeSending] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [challengeCategoryId, setChallengeCategoryId] = useState<string>("");
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

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

  const loadProfile = useCallback(async () => {
    try {
      const data = await profileService.getProfile(targetId);
      setProfile(data);
      // Back-end may return isFollowing on the profile object
      if (!isOwnProfile) {
        const following =
          data.isFollowing !== undefined
            ? data.isFollowing
            : await profileService.checkIsFollowing(targetId);
        setIsFollowing(following);
      }
    } catch {
      // Fallback to auth user for own profile
      if (isOwnProfile && user) setProfile(user);
    }
  }, [targetId, isOwnProfile, user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // If a challenge is accepted while I'm here, jump into the 1v1 battle.
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

  const handleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await profileService.unfollowUser(profile.id);
        setIsFollowing(false);
        setProfile((p) => p ? { ...p, followers: Math.max(0, p.followers - 1) } : p);
      } else {
        await profileService.followUser(profile.id);
        setIsFollowing(true);
        setProfile((p) => p ? { ...p, followers: p.followers + 1 } : p);
      }
    } catch {
      // silently ignore — no toast library assumed
    } finally {
      setFollowLoading(false);
    }
  };

  const ensureCategoriesLoaded = useCallback(async () => {
    if (allCategories.length > 0 || categoriesLoading) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const list = await fetchPublicCategories();
      setAllCategories(list);
    } catch {
      setCategoriesError("Could not load topics");
    } finally {
      setCategoriesLoading(false);
    }
  }, [allCategories.length, categoriesLoading]);

  const openChallengeModal = async () => {
    setChallengeStatus(null);
    setChallengeModalOpen(true);
    void ensureCategoriesLoaded();
  };

  const handleChallenge = async () => {
    if (!p || isOwnProfile) return;
    if (!user?.id) {
      navigate("/login");
      return;
    }

    // Open topic selection modal; actual send happens when a topic is chosen.
    openChallengeModal();
  };

  const sendChallengeForCategory = async (categoryIdRaw: string) => {
    if (!p || !user?.id) return;

    const categoryId = (categoryIdRaw || p.favoriteCategory || "science").toString().trim() || "science";
    setChallengeStatus(null);
    setChallengeSending(true);
    try {
      getSocket().emit("challenge:send", { toUserId: p.id, categoryId });
      setChallengeStatus("Challenge sent");
      toast.success("Challenge sent", { position: "top-center" });
      setChallengeModalOpen(false);
      setChallengeCategoryId(categoryId);
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

  const xpPercent = ((p.xp || 0) / (p.xpToNextLevel || 1)) * 100;
  const league = getLeagueFromXp(p.xp);
  const avatarSrc = resolveMediaUrl(
    p.avatarUrl,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.username)}`
  );

  const displayAchievements = MOCK_ACHIEVEMENTS.map(mockAch => {
    const unlocked = p.achievements?.find(a => a.id === mockAch.id);
    return {
      ...mockAch,
      isUnlocked: !!unlocked,
      unlockedAt: unlocked?.unlockedAt,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="quizup-header-purple px-4 py-3 flex items-center justify-between text-white shadow-sm">
        {isOwnProfile ? (
          <h1 className="font-display font-bold text-white text-base">
            {p.displayName || p.username}
          </h1>
        ) : (
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5">
            <ArrowLeft className="w-5 h-5 text-white/90" />
            <span className="font-display font-bold text-white text-base">
              {p.displayName || p.username}
            </span>
          </button>
        )}
        <div className="flex gap-3">
          <button><Search className="w-5 h-5 text-white/90" /></button>
          {isOwnProfile && (
            <button onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5 text-white/90" />
            </button>
          )}
        </div>
      </div>

      {/* Avatar + info */}
      <div className="bg-white px-6 py-8 text-center shadow-sm">
        <div className="relative inline-block mb-3 group">
          <div 
             className={`relative w-36 h-36 rounded-full border-4 border-white shadow-lg overflow-hidden ${isOwnProfile ? 'cursor-pointer' : ''}`}
             style={{ borderColor: "white" }}
             onClick={() => isOwnProfile && fileInputRef.current?.click()}
             role={isOwnProfile ? "button" : undefined}
             aria-label={isOwnProfile ? "Change profile photo" : undefined}
          >
            <img
              src={avatarSrc}
              alt=""
              className={`w-full h-full object-cover transition-opacity ${uploadingAvatar ? 'opacity-50' : 'opacity-100'}`}
            />
            {isOwnProfile && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? (
                       <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                       <Camera className="w-6 h-6 text-white" />
                    )}
                </div>
            )}
          </div>
          {isOwnProfile && (
             <input type="file" ref={fileInputRef} onChange={handleAvatarSelect} accept="image/*" className="hidden" />
          )}
          {/* <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-quizup-dark rounded-full px-3 py-0.5">
            <span className="text-[10px] font-bold text-quizup-gold">LVL {p.level}</span>
          </div> */}
        </div>
        <h2 className="font-display font-extrabold text-2xl text-slate-900">
          {p.displayName || p.username}
        </h2>
        <p className="text-sm text-slate-500 mt-1">{p.bio || "No bio yet"}</p>
        <p className="text-xs text-slate-400 mt-1">🌍 {p.country}</p>

        {/* League */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <img
            src={league.badgeUrl}
            alt=""
            className="w-10 h-10 object-contain drop-shadow-sm"
            loading="lazy"
          />
          <div className="text-left">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">League</p>
            <p className="text-sm font-display font-extrabold text-slate-900 leading-tight">
              {league.name}
            </p>
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <div className="bg-white border-t border-slate-100 px-6 py-4 shadow-sm mt-2">
        <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
          <span>Level {p.level}</span>
          <span>{p.xp} / {p.xpToNextLevel} XP</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full quizup-header-purple rounded-full transition-all duration-700"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border-t border-slate-100 flex divide-x divide-slate-100 shadow-sm mt-2">
        {[
          { label: "MATCHES", value: p.totalMatches },
          { label: "WINS", value: p.wins },
          { label: "LOSSES", value: p.losses },
          { label: "STREAK", value: p.winStreak },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 py-4 text-center">
            <p className="text-xl font-display font-extrabold text-slate-900">{value}</p>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Social counts */}
      <div className="bg-white border-t border-slate-100 flex divide-x divide-slate-100 shadow-sm">
        <div className="flex-1 py-4 text-center">
          <p className="text-lg font-display font-bold text-slate-900">{p.followers}</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">Followers</p>
        </div>
        <div className="flex-1 py-4 text-center">
          <p className="text-lg font-display font-bold text-slate-900">{p.following}</p>
          <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">Following</p>
        </div>
      </div>

      {/* Action row: follow / chat / challenge */}
      <div className="px-4 py-4 flex gap-2">
        {isOwnProfile ? (
          /* Own profile — just Play button */
          <button
            onClick={() => navigate("/categories")}
            className="flex-1 h-12 rounded-xl quizup-header-purple text-white shadow-md font-bold text-[15px] flex items-center justify-center gap-2"
          >
            ⚡ Play Now
          </button>
        ) : (
          <>
            {/* Follow / Unfollow */}
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex-1 h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                isFollowing
                  ? "bg-slate-100 text-slate-700 border border-slate-200"
                  : "quizup-header-purple text-white shadow-md"
              }`}
            >
              {followLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Follow
                </>
              )}
            </button>

            {/* Chat */}
            <button
              onClick={() => navigate(`/chat/${p.id}`)}
              className="flex-1 h-11 rounded-xl bg-white text-slate-700 font-semibold text-sm border border-slate-200 shadow-sm flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>

            {/* Challenge */}
            <button
              onClick={handleChallenge}
              disabled={challengeSending}
              className="flex-1 h-11 rounded-xl quizup-header-red text-white shadow-md font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {challengeSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Challenge
            </button>
          </>
        )}
      </div>

      {/* Challenge status (below actions) */}
      {!isOwnProfile && challengeStatus && (
        <div className="px-4 pb-2 text-center">
          <p className="text-xs text-slate-500 font-medium">{challengeStatus}</p>
        </div>
      )}

      {/* Achievements */}
      <div className="px-4 py-4">
        <h3 className="font-display font-bold text-slate-900 text-sm uppercase tracking-wider mb-4">
          Achievements
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {displayAchievements.map((a) => (
            <div
              key={a.id}
              className={`bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm ${
                !a.isUnlocked ? "opacity-40 grayscale" : ""
              }`}
              title={a.description}
            >
              <span className="text-2xl">{a.icon}</span>
              <p className="text-[9px] text-slate-600 font-medium mt-2 leading-tight">{a.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Logout — own profile only */}
      {isOwnProfile && (
        <div className="px-4 pb-6 mt-4">
          <button
            onClick={async () => { await logout(); navigate("/"); }}
            className="w-full h-12 rounded-xl bg-white border border-slate-200 text-quizup-red font-semibold text-[15px] flex items-center justify-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      )}

      {/* Chat is a dedicated page now: /chat/:peerId */}
      {!isOwnProfile && challengeModalOpen && (
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
                ✕
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
