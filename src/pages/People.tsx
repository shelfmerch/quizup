import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { ProfileFollowUser } from "@/types";
import { resolveMediaUrl } from "@/config/env";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OnlineIndicator } from "@/components/ui/OnlineIndicator";
import BottomNav from "@/components/BottomNav";

import {
  Users,
  UserCheck,
  Search,
  UserPlus,
  UserMinus,
  MessageCircle,
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
  isOnline: boolean;
  onFollow: (id: string) => Promise<void>;
  onUnfollow: (id: string) => Promise<void>;
  isFollowing: boolean;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  isOnline,
  onFollow,
  onUnfollow,
  isFollowing,
}) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

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
        className="flex-shrink-0 focus:outline-none relative"
      >
        <img
          src={avatar}
          alt={user.displayName}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 hover:ring-quizup-teal/60 transition-all"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`;
          }}
        />
        <OnlineIndicator
          isOnline={isOnline}
          className="absolute bottom-0 right-0 border-2 border-quizup-card rounded-full"
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
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const People: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<ProfileFollowUser[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // We can merge all user IDs to track online status
  const userIds = useMemo(() => {
    return users.map((u) => u.id);
  }, [users]);

  const { isOnline } = useOnlineStatus(userIds);

  // ── Fetch all users ──────────────────────────────────────────────────────────
  const fetchAllUsers = useCallback(async () => {
    setLoading(true);
    try {
      const allUsers = await profileService.getAllUsers();
      setUsers(allUsers);
      
      // Extract following status from user properties returned by custom API
      const followingIds = new Set<string>();
      allUsers.forEach((u) => {
        const userWithFollow = u as ProfileFollowUser & { isFollowing?: boolean };
        if (userWithFollow.isFollowing) {
          followingIds.add(u.id);
        }
      });
      setFollowingSet(followingIds);
    } catch {
      toast.error("Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

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
      toast.success("Unfollowed");
    } catch {
      toast.error("Could not unfollow user");
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.displayName && u.displayName.toLowerCase().includes(q))
      )
    : users;

  return (
    <div className="flex flex-col min-h-screen quizup-app">
      <div className="sticky top-0 z-20 flex flex-col">
        {/* Header */}
        <div className="quizup-header-teal px-4 py-3 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-white text-base">People</h1>
            <p className="text-xs text-white/70 mt-0.5">
              Discover other players in the QuizUp Arena
            </p>
          </div>
          <button
            onClick={() => navigate("/friends")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5" />
            My Friends
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players by name or username…"
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-quizup-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-quizup-teal/60 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-3 pb-24 space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <UserCardSkeleton key={i} />)
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">
              {q ? "No players found matching that search" : "No other players found"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
              {q
                ? "Try a different search term"
                : "Share the app with your friends to play together!"}
            </p>
          </div>
        ) : (
          filteredUsers.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isOnline={isOnline(u.id)}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              isFollowing={followingSet.has(u.id)}
            />
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default People;
