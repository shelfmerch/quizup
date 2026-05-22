import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOCK_CATEGORIES } from "@/data/mock-data";
import { EXTRA_HOME_TOPICS } from "@/data/extraTopics";
import { Category } from "@/types";
import {
  Heart,
  MessageSquare,
  Share2,
  Image as ImageIcon,
  Video,
  X,
  Send,
  RefreshCw,
  Lock,
  Users,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  communityService,
  CommunityPost,
  CategoryStatus,
} from "@/services/communityService";
import { resolveMediaUrl, resolveQuestionImageUrl } from "@/lib/mediaUrl";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const CATEGORY_THEMES: Record<
  string,
  { header: string; accent: string; glow: string }
> = {
  "quizup-header-red": { header: "quizup-header-red", accent: "#e05252", glow: "rgba(224,82,82,0.35)" },
  "quizup-header-green": { header: "quizup-header-green", accent: "#2dbd7e", glow: "rgba(45,189,126,0.35)" },
  "quizup-header-teal": { header: "quizup-header-teal", accent: "#1aaa9b", glow: "rgba(26,170,155,0.35)" },
  "quizup-header-blue": { header: "quizup-header-blue", accent: "#3d8ef0", glow: "rgba(61,142,240,0.35)" },
  "quizup-header-purple": { header: "quizup-header-purple", accent: "#9966cc", glow: "rgba(153,102,204,0.35)" },
  "quizup-header-orange": { header: "quizup-header-orange", accent: "#e87030", glow: "rgba(232,112,48,0.35)" },
  "bg-white": { header: "bg-white", accent: "#555555", glow: "rgba(200,200,200,0.35)" },
};

const CATEGORY_COLORS = [
  "quizup-header-red",
  "quizup-header-green",
  "quizup-header-teal",
  "quizup-header-blue",
  "quizup-header-purple",
  "quizup-header-orange",
  "bg-white",
];

function mergeAllCategories(): Category[] {
  const byId = new Map<string, Category>();
  MOCK_CATEGORIES.forEach((c) => byId.set(c.id, c));
  EXTRA_HOME_TOPICS.forEach((c) => { if (!byId.has(c.id)) byId.set(c.id, c); });
  return Array.from(byId.values());
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const sec = Math.floor((now - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function avatarUrl(author: { avatarUrl?: string; username?: string }, seed?: string): string {
  return (
    resolveMediaUrl(author.avatarUrl) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || author.username || "user")}`
  );
}

function userIdMatches(likes: string[], userId?: string): boolean {
  if (!userId) return false;
  return likes.some((id) => String(id) === String(userId));
}

interface CommunityFeedProps {
  categoryId: string;
  categoryName: string;
  accentColor?: string;
}

const PostSkeleton: React.FC = () => (
  <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm animate-pulse">
    <div className="flex gap-3">
      <div className="h-11 w-11 shrink-0 rounded-full bg-[#e9edef]" />
      <div className="flex-1 space-y-2.5">
        <div className="h-3.5 w-32 rounded-md bg-[#e9edef]" />
        <div className="h-3 w-full rounded-md bg-[#f0f2f5]" />
        <div className="h-3 w-4/5 rounded-md bg-[#f0f2f5]" />
        <div className="mt-2 flex gap-2">
          <div className="h-8 w-16 rounded-full bg-[#f0f2f5]" />
          <div className="h-8 w-16 rounded-full bg-[#f0f2f5]" />
        </div>
      </div>
    </div>
  </div>
);

const CommunityFeed: React.FC<CommunityFeedProps> = ({
  categoryId,
  categoryName,
  accentColor = "#3d8ef0",
}) => {
  const { user } = useAuth();
  const isAuthenticated = !!user?.id;

  const [communityStatus, setCommunityStatus] = useState<CategoryStatus | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<Record<string, boolean>>({});
  const [likeBusy, setLikeBusy] = useState<Set<string>>(new Set());
  const [apiCategories, setApiCategories] = useState<Category[]>([]);


  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const list = await communityService.getPosts(categoryId);
      setPosts(list);
    } catch {
      toast.error("Could not load community posts", { position: "top-center" });
    } finally {
      setLoadingPosts(false);
    }
  }, [categoryId]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCommunityStatus(null);
      return;
    }
    communityService
      .getStatus(categoryId)
      .then(setCommunityStatus)
      .catch(() => setCommunityStatus({ playedMatches: 0, communityUnlocked: false }));
  }, [categoryId, isAuthenticated]);

  useEffect(() => {
    if (communityStatus?.communityUnlocked) {
      loadPosts();
    }
  }, [communityStatus?.communityUnlocked, loadPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
    toast.success("Feed updated", { position: "top-center", duration: 1500 });
  };

  const setMediaAttachment = (file: File, kind: "image" | "video") => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaKind(kind);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMediaAttachment(file, "image");
    e.target.value = "";
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Video must be 50 MB or smaller", { position: "top-center" });
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|m4v|3gp)$/i.test(file.name)) {
      toast.error("Use MP4, MOV, or WebM video", { position: "top-center" });
      e.target.value = "";
      return;
    }
    setMediaAttachment(file, "video");
    e.target.value = "";
  };

  const removeMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!newPostContent.trim() && !mediaFile) return;
    setIsPosting(true);
    try {
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;
      if (mediaFile && mediaKind === "video") {
        videoUrl = await communityService.uploadVideo(mediaFile);
      } else if (mediaFile && mediaKind === "image") {
        imageUrl = await communityService.uploadImage(mediaFile);
      }
      const post = await communityService.createPost(categoryId, newPostContent, {
        imageUrl,
        videoUrl,
      });
      setPosts((prev) => [post, ...prev]);
      setNewPostContent("");
      removeMedia();
      toast.success("Posted to the community!", { position: "top-center" });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const msg =
        e.response?.data?.error ||
        (err instanceof Error ? err.message : e.message) ||
        "Failed to post";
      toast.error(msg, { position: "top-center" });
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (likeBusy.has(postId)) return;
    setLikeBusy((s) => new Set(s).add(postId));
    const prev = posts.find((p) => p._id === postId);
    if (!prev || !user?.id) return;

    const wasLiked = userIdMatches(prev.likes, user.id);
    setPosts((list) =>
      list.map((p) => {
        if (p._id !== postId) return p;
        const likes = wasLiked
          ? p.likes.filter((id) => String(id) !== String(user.id))
          : [...p.likes, user.id];
        return { ...p, likes };
      })
    );

    try {
      const res = await communityService.likePost(postId);
      setPosts((list) =>
        list.map((p) => {
          if (p._id !== postId) return p;
          const likes = p.likes.filter((id) => String(id) !== String(user.id));
          if (res.liked && user.id) likes.push(user.id);
          return { ...p, likes };
        })
      );
    } catch {
      setPosts((list) => list.map((p) => (p._id === postId ? prev : p)));
      toast.error("Could not update like", { position: "top-center" });
    } finally {
      setLikeBusy((s) => {
        const next = new Set(s);
        next.delete(postId);
        return next;
      });
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleComment = async (postId: string) => {
    const text = (commentDrafts[postId] || "").trim();
    if (!text || commentBusy[postId]) return;
    setCommentBusy((b) => ({ ...b, [postId]: true }));
    try {
      const updated = await communityService.addComment(postId, text);
      setPosts((list) => list.map((p) => (p._id === postId ? updated : p)));
      setCommentDrafts((d) => ({ ...d, [postId]: "" }));
      setExpandedPosts((prev) => new Set(prev).add(postId));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to comment";
      toast.error(msg, { position: "top-center" });
    } finally {
      setCommentBusy((b) => ({ ...b, [postId]: false }));
    }
  };

  const handleShare = async (post: CommunityPost) => {
    const snippet = post.content.trim().slice(0, 120);
    const text = snippet
      ? `${post.authorId.displayName || post.authorId.username} in ${categoryName}: "${snippet}${post.content.length > 120 ? "…" : ""}"`
      : `${post.authorId.displayName || post.authorId.username} shared a post in ${categoryName} on QuizUp`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${categoryName} Community`,
          text,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        toast.success("Link copied to clipboard!", { position: "top-center" });
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast.error("Could not share", { position: "top-center" });
      }
    }
  };

    // Find the category from merged data
    const allCategories = useMemo(() => {
      const local = mergeAllCategories();
      const byId = new Map<string, Category>();
      local.forEach((c) => byId.set(c.id, c));
      apiCategories.forEach((c) => byId.set(c.id, c)); // API wins
      return Array.from(byId.values());
    }, [apiCategories]);
  
    const category = useMemo(
      () => allCategories.find((c) => c.id === categoryId) ?? null,
      [allCategories, categoryId]
    );

    // Determine theme color based on list order
    const themeKey = useMemo(() => {
      const idx = allCategories.findIndex((c) => c.id === categoryId);
      return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
    }, [allCategories, categoryId]);
  
    const theme = CATEGORY_THEMES[themeKey] ?? CATEGORY_THEMES["quizup-header-teal"];

  const matchesLeft = Math.max(0, 25 - (communityStatus?.playedMatches || 0));
  const progressPct = Math.min(100, ((communityStatus?.playedMatches || 0) / 25) * 100);

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-[#e5e7eb] bg-white px-6 py-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0f2f5]">
          <Lock className="h-7 w-7 text-[#65676b]" strokeWidth={2} />
        </div>
        <h3 className="font-display text-lg font-extrabold text-[#242424]">Sign in to join</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-[#65676b]">
          Log in to unlock the {categoryName} community and connect with other players.
        </p>
      </div>
    );
  }

  if (!communityStatus?.communityUnlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-[#e5e7eb] bg-white px-6 py-10 text-center shadow-sm"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ background: `radial-gradient(circle at 50% 0%, ${accentColor}, transparent 65%)` }}
        />
        <div
          className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e5e7eb] bg-[#f8f9fa] shadow-inner"
          style={{ color: accentColor }}
        >
          <Lock className="h-8 w-8" strokeWidth={2} />
        </div>
        <h3 className="relative font-display text-xl font-extrabold text-[#242424]">Community locked</h3>
        <p className="relative mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-[#65676b]">
          Play {matchesLeft} more {matchesLeft === 1 ? "match" : "matches"} in{" "}
          <span className="font-semibold text-[#242424]">{categoryName}</span> to unlock posts, likes, and
          comments.
        </p>
        <div className="relative mx-auto mt-6 max-w-[240px]">
          <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-wide text-[#8a8d91]">
            <span>Progress</span>
            <span>{communityStatus?.playedMatches || 0} / 25</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#e9edef]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: accentColor }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      {/* <div className='flex items-center justify-between border-b border-[#e5e7eb] pb-3 w-full'>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white shadow-sm"
            style={{ color: accentColor }}
          >
            <Users className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <h3 className="font-display text-[17px] font-extrabold leading-tight tracking-tight text-[#242424]">
              Community
            </h3>
            <p className="text-[12px] font-medium text-[#65676b]">{categoryName} · discussion feed</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loadingPosts}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#65676b] shadow-sm transition-colors hover:bg-[#f0f2f5] hover:text-[#242424] disabled:opacity-40"
          aria-label="Refresh feed"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div> */}

      {/* Composer */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#8a8d91]">Create post</p>
        <div className="flex gap-3">
          <img
            src={avatarUrl(user || {}, user?.username)}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-[#e5e7eb]"
          />
          <div className="min-w-0 flex-1">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={`Share a score, tip, or question about ${categoryName}…`}
              rows={2}
              className="custom-scrollbar min-h-[76px] w-full resize-none rounded-xl border border-[#e5e7eb] bg-[#f0f2f5] px-3.5 py-3 text-[15px] leading-snug text-[#242424] outline-none transition-[box-shadow,background-color] placeholder:text-[#8a8d91] focus:border-[#ccd0d5] focus:bg-white focus:ring-2 focus:ring-[#e7f3ff]"
            />

            <AnimatePresence>
              {mediaPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative mt-3 inline-block max-w-full"
                >
                  {mediaKind === "video" ? (
                    <video
                      src={mediaPreview}
                      controls
                      className="max-h-44 max-w-full rounded-lg border border-[#e5e7eb] bg-black shadow-sm"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="max-h-44 w-auto rounded-lg border border-[#e5e7eb] object-cover shadow-sm"
                    />
                  )}
                  <button
                    type="button"
                    onClick={removeMedia}
                    className="absolute -right-2 -top-2 rounded-full border border-[#e5e7eb] bg-white p-1.5 text-[#65676b] shadow-md transition-colors hover:bg-[#f0f2f5] hover:text-[#242424]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-3 flex items-center justify-between border-t border-[#f0f2f5] pt-3">
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={videoInputRef}
                onChange={handleVideoChange}
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
                className="hidden"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={!!mediaFile && mediaKind === "video"}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-[#65676b] transition-colors hover:bg-[#f0f2f5] hover:text-[#242424] disabled:opacity-40"
                >
                  <ImageIcon className="h-[18px] w-[18px]" style={{ color: accentColor }} />
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={!!mediaFile && mediaKind === "image"}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-[#65676b] transition-colors hover:bg-[#f0f2f5] hover:text-[#242424] disabled:opacity-40"
                >
                  <Video className="h-[18px] w-[18px]" style={{ color: accentColor }} />
                  Video
                </button>
              </div>
              <button
                type="button"
                disabled={(!newPostContent.trim() && !mediaFile) || isPosting}
                onClick={handlePost}
                style={{ backgroundColor: accentColor }}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPosting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Posting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Post count pill */}
      {!loadingPosts && posts.length > 0 && (
        <p className="px-0.5 text-[12px] font-semibold text-[#65676b]">
          {posts.length} {posts.length === 1 ? "post" : "posts"} in this topic
        </p>
      )}

      {/* Feed */}
      {loadingPosts && posts.length === 0 ? (
        <div className="space-y-3">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#ccd0d5] bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f2f5]">
            <MessageSquare className="h-6 w-6 text-[#8a8d91]" />
          </div>
          <p className="font-display text-[15px] font-extrabold text-[#242424]">No posts yet</p>
          <p className="mt-1 text-sm text-[#65676b]">Be the first to start the conversation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const isLiked = userIdMatches(post.likes, user?.id);
            const isExpanded = expandedPosts.has(post._id);
            const commentCount = post.comments.length;
            const previewComments = isExpanded ? post.comments : post.comments.slice(-2);
            const showViewMore = !isExpanded && commentCount > 2;
            const authorName = post.authorId.displayName || post.authorId.username;

            return (
              <motion.article
                key={post._id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              >
                <div className="flex gap-3 p-4">
                  <img
                    src={avatarUrl(post.authorId)}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-[#e5e7eb]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display text-[15px] font-extrabold leading-tight text-[#242424]">
                          {authorName}
                        </p>
                        <p className="truncate text-[12px] font-medium text-[#65676b]">
                          @{post.authorId.username} · {formatRelativeTime(post.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-1.5 text-[#8a8d91] transition-colors hover:bg-[#f0f2f5] hover:text-[#65676b]"
                        aria-label="More options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    {post.content.trim() && (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#242424]">
                        {post.content}
                      </p>
                    )}

                    {post.videoUrl && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-black">
                        <video
                          src={resolveMediaUrl(post.videoUrl)}
                          controls
                          playsInline
                          className="max-h-[360px] w-full"
                          preload="metadata"
                        />
                      </div>
                    )}

                    {post.imageUrl && !post.videoUrl && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8f9fa]">
                        <img
                          src={resolveQuestionImageUrl(post.imageUrl)!}
                          alt="Post attachment"
                          className="max-h-[360px] w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Reactions summary */}
                    {(post.likes.length > 0 || commentCount > 0) && (
                      <div className="mt-3 flex items-center justify-between border-b border-[#f0f2f5] pb-2 text-[12px] font-medium text-[#65676b]">
                        {post.likes.length > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#f02849] text-white">
                              <Heart className="h-2.5 w-2.5 fill-current" />
                            </span>
                            {post.likes.length}
                          </span>
                        )}
                        {commentCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleComments(post._id)}
                            className="hover:underline"
                          >
                            {commentCount} {commentCount === 1 ? "comment" : "comments"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="mt-1 flex items-center justify-around border-t border-[#f0f2f5] pt-1">
                      <button
                        type="button"
                        onClick={() => handleLike(post._id)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold transition-colors ${
                          isLiked
                            ? "text-[#f02849]"
                            : "text-[#65676b] hover:bg-[#f0f2f5] hover:text-[#f02849]"
                        }`}
                      >
                        <Heart className={`h-[18px] w-[18px] ${isLiked ? "fill-current" : ""}`} />
                        Like
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleComments(post._id)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold transition-colors ${
                          isExpanded
                            ? "text-[#1877f2]"
                            : "text-[#65676b] hover:bg-[#f0f2f5] hover:text-[#1877f2]"
                        }`}
                      >
                        <MessageSquare className="h-[18px] w-[18px]" />
                        Comment
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(post)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold text-[#65676b] transition-colors hover:bg-[#f0f2f5] hover:text-[#242424]"
                      >
                        <Share2 className="h-[18px] w-[18px]" />
                        Share
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comments */}
                <AnimatePresence>
                  {(isExpanded || commentCount > 0) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[#f0f2f5] bg-[#f8f9fa] px-4 py-3"
                    >
                      {showViewMore && (
                        <button
                          type="button"
                          onClick={() => toggleComments(post._id)}
                          className="mb-3 text-[13px] font-semibold text-[#65676b] hover:text-[#1877f2] hover:underline"
                        >
                          View all {commentCount} comments
                        </button>
                      )}

                      <div className="space-y-2.5">
                        {(isExpanded ? post.comments : previewComments).map((c) => (
                          <div key={c._id} className="flex gap-2">
                            <img
                              src={avatarUrl(c.authorId)}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[#e5e7eb]"
                            />
                            <div className="min-w-0 flex-1 rounded-[18px] rounded-tl-md bg-[#f0f2f5] px-3 py-2">
                              <p className="text-[13px] font-bold text-[#242424]">
                                {c.authorId.displayName || c.authorId.username}
                                <span className="ml-2 font-normal text-[#8a8d91]">
                                  {formatRelativeTime(c.createdAt)}
                                </span>
                              </p>
                              <p className="mt-0.5 break-words text-[14px] leading-snug text-[#242424]">
                                {c.text}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {isExpanded && (
                        <div className="mt-3 flex gap-2 border-t border-[#e5e7eb] pt-3">
                          <img
                            src={avatarUrl(user || {}, user?.username)}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[#e5e7eb]"
                          />
                          <div className="flex min-w-0 flex-1 gap-2">
                            <input
                              type="text"
                              value={commentDrafts[post._id] || ""}
                              onChange={(e) =>
                                setCommentDrafts((d) => ({ ...d, [post._id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleComment(post._id);
                                }
                              }}
                              placeholder={`Reply to ${authorName}…`}
                              className="min-w-0 flex-1 rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-[14px] text-[#242424] outline-none placeholder:text-[#8a8d91] focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2]/30"
                            />
                            <button
                              type="button"
                              disabled={!(commentDrafts[post._id] || "").trim() || commentBusy[post._id]}
                              onClick={() => handleComment(post._id)}
                              style={{ backgroundColor: accentColor }}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-all hover:brightness-105 disabled:opacity-40"
                              aria-label="Send comment"
                            >
                              {commentBusy[post._id] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {!isExpanded && commentCount === 0 && (
                        <button
                          type="button"
                          onClick={() => toggleComments(post._id)}
                          className="mt-2 text-[13px] font-semibold text-[#65676b] hover:text-[#1877f2]"
                        >
                          Write a comment…
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;
