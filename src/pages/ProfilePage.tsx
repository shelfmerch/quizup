import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { Profile } from "@/types";
import { MOCK_ACHIEVEMENTS } from "@/data/mock-data";
import { resolveMediaUrl } from "@/config/env";
import { Settings, LogOut, Search, ArrowLeft, UserPlus, UserCheck, MessageCircle, Loader2, Camera } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

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

  const p = profile ?? (isOwnProfile ? user : null);
  if (!p) {
    return (
      <div className="min-h-screen bg-quizup-dark flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  const xpPercent = ((p.xp || 0) / (p.xpToNextLevel || 1)) * 100;
  const avatarSrc = resolveMediaUrl(
    p.avatarUrl,
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.username)}`
  );

  return (
    <div className="min-h-screen bg-quizup-dark">
      {/* Header */}
      <div className="quizup-header-purple px-4 py-3 flex items-center justify-between">
        {isOwnProfile ? (
          <h1 className="font-display font-bold text-foreground text-base">
            {p.displayName || p.username}
          </h1>
        ) : (
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5">
            <ArrowLeft className="w-5 h-5 text-foreground/80" />
            <span className="font-display font-bold text-foreground text-base">
              {p.displayName || p.username}
            </span>
          </button>
        )}
        <div className="flex gap-3">
          <button><Search className="w-5 h-5 text-foreground/80" /></button>
          {isOwnProfile && (
            <button onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5 text-foreground/80" />
            </button>
          )}
        </div>
      </div>

      {/* Avatar + info */}
      <div className="bg-quizup-card p-6 text-center">
        <div className="relative inline-block mb-3 group">
          <div 
             className={`relative w-24 h-24 rounded-full border-4 border-quizup-dark overflow-hidden ${isOwnProfile ? 'cursor-pointer' : ''}`}
             style={{ borderColor: "hsl(270 60% 50%)" }}
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
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-quizup-dark rounded-full px-3 py-0.5">
            <span className="text-[10px] font-bold text-quizup-gold">LVL {p.level}</span>
          </div>
        </div>
        <h2 className="font-display font-extrabold text-xl text-foreground">
          {p.displayName || p.username}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{p.bio}</p>
        <p className="text-xs text-muted-foreground mt-0.5">🌍 {p.country}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Last Active: just now</p>
      </div>

      {/* XP Bar */}
      <div className="bg-quizup-card border-t border-border px-4 py-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Level {p.level}</span>
          <span>{p.xp}/{p.xpToNextLevel} XP</span>
        </div>
        <div className="w-full h-2 bg-quizup-surface rounded-full overflow-hidden">
          <div
            className="h-full quizup-header-purple rounded-full transition-all duration-700"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="bg-quizup-card border-t border-border flex divide-x divide-border">
        {[
          { label: "MATCHES", value: p.totalMatches },
          { label: "WINS", value: p.wins },
          { label: "LOSSES", value: p.losses },
          { label: "STREAK", value: p.winStreak },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 py-3 text-center">
            <p className="text-lg font-display font-extrabold text-foreground">{value}</p>
            <p className="text-[9px] text-muted-foreground tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Social counts */}
      <div className="bg-quizup-card border-t border-border flex divide-x divide-border">
        <div className="flex-1 py-3 text-center">
          <p className="font-display font-bold text-foreground">{p.followers}</p>
          <p className="text-[10px] text-muted-foreground">Followers</p>
        </div>
        <div className="flex-1 py-3 text-center">
          <p className="font-display font-bold text-foreground">{p.following}</p>
          <p className="text-[10px] text-muted-foreground">Following</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 flex gap-2">
        {isOwnProfile ? (
          /* Own profile — just Play button */
          <button
            onClick={() => navigate("/categories")}
            className="flex-1 h-11 rounded-lg quizup-header-red text-foreground font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            ⚡ Play
          </button>
        ) : (
          <>
            {/* Follow / Unfollow */}
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex-1 h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                isFollowing
                  ? "bg-quizup-surface text-foreground border border-border"
                  : "quizup-header-purple text-foreground"
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
              className="flex-1 h-11 rounded-lg bg-quizup-surface text-foreground font-semibold text-sm border border-border flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
          </>
        )}
      </div>

      {/* Achievements */}
      <div className="px-4 pb-4">
        <h3 className="font-display font-bold text-foreground text-sm uppercase tracking-wider mb-3">
          Achievements
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {MOCK_ACHIEVEMENTS.map((a) => (
            <div
              key={a.id}
              className={`bg-quizup-card rounded-lg p-2 text-center border border-border ${
                !a.isUnlocked ? "opacity-25" : ""
              }`}
            >
              <span className="text-xl">{a.icon}</span>
              <p className="text-[8px] text-muted-foreground mt-1 truncate">{a.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Logout — own profile only */}
      {isOwnProfile && (
        <div className="px-4 pb-6">
          <button
            onClick={async () => { await logout(); navigate("/"); }}
            className="w-full h-11 rounded-lg bg-quizup-card border border-border text-quizup-red font-semibold text-sm flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      )}

      {/* Chat is a dedicated page now: /chat/:peerId */}
    </div>
  );
};

export default ProfilePage;
