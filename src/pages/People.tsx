import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { ProfileFollowUser } from "@/types";
import { resolveMediaUrl } from "@/config/env";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  Search,
  UserPlus,
  UserMinus,
  MessageCircle,
  ChevronRight,
} from "lucide-react";

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const UserCardSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-quizup-card animate-pulse">
    <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0" />
    <div className="flex-1 space-y-2 min-w-0">
      <div className="h-3.5 w-28 rounded bg-white/10" />
      <div className="h-3 w-20 rounded bg-white/10" />
    </div>
    <div className="h-8 w-24 rounded-lg bg-white/10" />
  </div>
);

// ─── Country flag helper ────────────────────────────────────────────────────────
const countryFlag = (code: string) => {
  if (!code || code.length !== 2) return "";
  const offset = 127397;
  return Array.from(code.toUpperCase())
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + offset))
    .join("");
};

// ─── User Card ─────────────────────────────────────────────────────────────────
interface UserCardProps {
  user: ProfileFollowUser;
  index: number;
  mode: "follower" | "following";
  onFollow: (id: string) => Promise<void>;
  onUnfollow: (id: string) => Promise<void>;
  followingSet: Set<string>; // IDs the current user already follows
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  index,
  mode,
  onFollow,
  onUnfollow,
  followingSet,
}) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const isFollowing = followingSet.has(user.id);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (isFollowing) {
        await onUnfollow(user.id);
      } else {
        await onFollow(user.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const avatar =
    resolveMediaUrl(user.avatarUrl) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-quizup-card border border-white/5 hover:border-white/10 transition-all">
      {/* Avatar */}
      <button
        onClick={() => navigate(`/profile/${user.id}`)}
        className="flex-shrink-0 focus:outline-none"
      >
        <img
          src={avatar}
          alt={user.displayName}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 hover:ring-quizup-teal/60 transition-all"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`;
          }}
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate leading-tight">
          {user.displayName || user.username}
          {user.country && (
            <span className="ml-1 text-base" title={user.country}>
              {countryFlag(user.country)}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-quizup-teal/20 text-quizup-teal">
          Lvl {user.level}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Chat */}
        <button
          onClick={() => navigate(`/chat/${user.id}`)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
          title="Chat"
        >
          <MessageCircle className="w-4 h-4" />
        </button>

        {/* Follow / Unfollow */}
        <button
          onClick={handleToggle}
          disabled={busy}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
            isFollowing
              ? "bg-white/8 text-muted-foreground hover:bg-red-500/15 hover:text-red-400"
              : "quizup-header-green text-white hover:opacity-90"
          }`}
        >
          {busy ? (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isFollowing ? (
            <>
              <UserMinus className="w-3 h-3" />
              Unfollow
            </>
          ) : (
            <>
              <UserPlus className="w-3 h-3" />
              Follow
            </>
          )}
        </button>

        {/* Number circle */}
        <span className="ml-1 flex items-center justify-center w-6 h-6 rounded-full bg-white/8 border border-white/10 text-[10px] font-bold text-muted-foreground shrink-0">
          {index + 1}
        </span>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
type Tab = "followers" | "following";

const People: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("followers");
  const [followers, setFollowers] = useState<ProfileFollowUser[]>([]);
  const [following, setFollowing] = useState<ProfileFollowUser[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loadingFollowers, setLoadingFollowers] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [query, setQuery] = useState("");

  // ── Fetch both lists ──────────────────────────────────────────────────────────
  const fetchFollowers = useCallback(async () => {
    if (!user?.id) return;
    setLoadingFollowers(true);
    try {
      const data = await profileService.getFollowers(user.id);
      setFollowers(data);
    } catch {
      toast.error("Could not load followers");
    } finally {
      setLoadingFollowers(false);
    }
  }, [user?.id]);

  const fetchFollowing = useCallback(async () => {
    setLoadingFollowing(true);
    try {
      const data = await profileService.getFollowingUsers();
      setFollowing(data);
      setFollowingSet(new Set(data.map((u) => u.id)));
    } catch {
      toast.error("Could not load following");
    } finally {
      setLoadingFollowing(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowers();
    fetchFollowing();
  }, [fetchFollowers, fetchFollowing]);

  // ── Follow / Unfollow ─────────────────────────────────────────────────────────
  const handleFollow = async (targetId: string) => {
    try {
      await profileService.followUser(targetId);
      setFollowingSet((prev) => new Set([...prev, targetId]));
      toast.success("Following!");
    } catch {
      toast.error("Could not follow user");
    }
  };

  const handleUnfollow = async (targetId: string) => {
    try {
      await profileService.unfollowUser(targetId);
      setFollowingSet((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      // Remove from following list if on that tab
      setFollowing((prev) => prev.filter((u) => u.id !== targetId));
      toast.success("Unfollowed");
    } catch {
      toast.error("Could not unfollow user");
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const filteredFollowers = q
    ? followers.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q)
      )
    : followers;

  const filteredFollowing = q
    ? following.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q)
      )
    : following;

  const list = activeTab === "followers" ? filteredFollowers : filteredFollowing;
  const loading =
    activeTab === "followers" ? loadingFollowers : loadingFollowing;

  return (
    <div className="h-[100dvh] flex flex-col max-w-md mx-auto overflow-hidden">
      {/* Header */}
      <div className="quizup-header-teal px-4 py-3 shadow-sm">
        <h1 className="font-display font-bold text-white text-base">People</h1>
        <p className="text-xs text-white/70 mt-0.5">
          {followers.length} follower{followers.length !== 1 ? "s" : ""} · {following.length} following
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-quizup-card border-b border-border sticky top-0 z-10">
        {(["followers", "following"] as Tab[]).map((tab) => {
          const count = tab === "followers" ? followers.length : following.length;
          const Icon = tab === "followers" ? Users : UserCheck;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setQuery(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
                isActive
                  ? "border-quizup-teal text-quizup-teal"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="capitalize">{tab}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? "bg-quizup-teal/20 text-quizup-teal"
                    : "bg-white/8 text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${activeTab}…`}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-quizup-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-quizup-teal/60 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <UserCardSkeleton key={i} />)
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {activeTab === "followers" ? (
              <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
            ) : (
              <UserCheck className="w-12 h-12 text-muted-foreground/40 mb-3" />
            )}
            <p className="text-sm font-semibold text-muted-foreground">
              {q
                ? "No results found"
                : activeTab === "followers"
                ? "No followers yet"
                : "Not following anyone yet"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
              {q
                ? "Try a different search term"
                : activeTab === "followers"
                ? "Win matches and climb the leaderboard to attract followers!"
                : "Follow players from the Leaderboard to see them here."}
            </p>
          </div>
        ) : (
          list.map((u, i) => (
            <UserCard
              key={u.id}
              user={u}
              index={i}
              mode={activeTab === "followers" ? "follower" : "following"}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              followingSet={followingSet}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default People;
