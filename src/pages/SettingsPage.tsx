import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, ChevronRight, Globe, Lock, Loader2, UserCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { resolveMediaUrl } from "@/config/env";
import { ProfileFollowUser } from "@/types";

type AvatarPrivacy = "public" | "private";

const normalizeAvatarPrivacy = (value: unknown): AvatarPrivacy => {
  if (value === "private" || value === "followers_only") return "private";
  return "public";
};

// ── Edit Profile Modal ────────────────────────────────────────────────────────
const EditProfileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarPrivacy, setAvatarPrivacy] = useState<AvatarPrivacy>(
    normalizeAvatarPrivacy(user?.avatarPrivacy)
  );
  const [allowedFollowerIds, setAllowedFollowerIds] = useState<Set<string>>(
    () => new Set(user?.avatarAllowedFollowers ?? [])
  );
  const [followers, setFollowers] = useState<ProfileFollowUser[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentAvatar =
    avatarPreview ||
    resolveMediaUrl(user?.avatarUrl) ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username || "u")}`;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setFollowersLoading(true);
    profileService
      .getFollowers(user.id)
      .then((rows) => {
        if (!cancelled) setFollowers(rows);
      })
      .catch(() => {
        if (!cancelled) setFollowers([]);
      })
      .finally(() => {
        if (!cancelled) setFollowersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleAllowedFollower = (followerId: string) => {
    setAllowedFollowerIds((prev) => {
      const next = new Set(prev);
      if (next.has(followerId)) next.delete(followerId);
      else next.add(followerId);
      return next;
    });
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Upload new avatar if changed
      if (avatarFile) {
        await profileService.uploadAvatar(avatarFile);
      }
      // Update text fields & privacy
      await profileService.updateProfile({
        displayName,
        bio,
        avatarPrivacy,
        avatarAllowedFollowers:
          avatarPrivacy === "private" ? Array.from(allowedFollowerIds) : [],
      });
      await refreshUser();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f4f4]">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={onClose} className="p-1 text-slate-500 active:text-slate-900">
          <X className="w-5 h-5" />
        </button>
        <h2 className="flex-1 font-display font-bold text-slate-900 text-base">Edit Profile</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#f65357] text-white text-sm font-bold rounded-full disabled:opacity-60 active:scale-95 transition-transform"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {/* Avatar picker */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <img
              src={currentAvatar}
              alt=""
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#f65357] flex items-center justify-center shadow-md border-2 border-white active:scale-90 transition-transform"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Tap camera to change photo</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarPick}
          />
        </div>

        {/* Display name */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            className="w-full text-[15px] text-slate-900 font-medium bg-transparent outline-none placeholder:text-slate-300"
            placeholder="Your name"
          />
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={120}
            rows={3}
            className="w-full text-[15px] text-slate-900 font-medium bg-transparent outline-none resize-none placeholder:text-slate-300"
            placeholder="Tell the world a little about yourself…"
          />
          <p className="text-right text-[11px] text-slate-300 mt-1">{bio.length}/120</p>
        </div>

        {/* Avatar Privacy */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Profile Photo Visibility
            </p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Choose who can see your profile picture
            </p>
          </div>

          {/* Public option */}
          <button
            type="button"
            onClick={() => setAvatarPrivacy("public")}
            className={`w-full flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 transition-colors ${
              avatarPrivacy === "public" ? "bg-emerald-50" : "active:bg-slate-50"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                avatarPrivacy === "public" ? "bg-emerald-500" : "bg-slate-100"
              }`}
            >
              <Globe className={`w-4 h-4 ${avatarPrivacy === "public" ? "text-white" : "text-slate-400"}`} />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-[14px] font-semibold ${avatarPrivacy === "public" ? "text-emerald-700" : "text-slate-800"}`}>
                Public
              </p>
              <p className="text-[11px] text-slate-400">Everyone can see your photo</p>
            </div>
            {avatarPrivacy === "public" && (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
          </button>

          {/* Private option */}
          <button
            type="button"
            onClick={() => setAvatarPrivacy("private")}
            className={`w-full flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 transition-colors ${
              avatarPrivacy === "private" ? "bg-blue-50" : "active:bg-slate-50"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                avatarPrivacy === "private" ? "bg-blue-500" : "bg-slate-100"
              }`}
            >
              <Lock className={`w-4 h-4 ${avatarPrivacy === "private" ? "text-white" : "text-slate-400"}`} />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-[14px] font-semibold ${avatarPrivacy === "private" ? "text-blue-700" : "text-slate-800"}`}>
                Private
              </p>
              <p className="text-[11px] text-slate-400">Choose which followers can see your profile photo</p>
            </div>
            {avatarPrivacy === "private" && (
              <Check className="w-4 h-4 text-blue-500 shrink-0" />
            )}
          </button>

          {avatarPrivacy === "private" && (
            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Allowed followers
              </p>
              {followersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : followers.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2 text-center">
                  No followers yet. When someone follows you, you can allow them here.
                </p>
              ) : (
                <ul className="max-h-48 overflow-y-auto space-y-1.5">
                  {followers.map((person) => {
                    const selected = allowedFollowerIds.has(person.id);
                    const thumb =
                      resolveMediaUrl(person.avatarUrl) ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(person.username)}`;
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => toggleAllowedFollower(person.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                            selected
                              ? "bg-blue-100 border-blue-200"
                              : "bg-white border-slate-100 active:bg-slate-50"
                          }`}
                        >
                          <img
                            src={thumb}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-white shadow-sm"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-[13px] font-semibold text-slate-800 truncate">
                              {person.displayName || person.username}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">@{person.username}</p>
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              selected ? "bg-blue-500" : "bg-slate-200"
                            }`}
                          >
                            {selected ? (
                              <UserCheck className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-white" />
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {followers.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  {allowedFollowerIds.size} of {followers.length} follower
                  {followers.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-center text-[13px] text-red-500 font-medium">{error}</p>
        )}
      </div>
    </div>
  );
};

// ── Main Settings Page ────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const items: Array<{ label: string; onClick?: () => void }> = [
    { label: "Edit Profile", onClick: () => setEditOpen(true) },
    { label: "Notifications" },
    { label: "Sound Effects" },
    { label: "Privacy Policy" },
    { label: "Terms of Service" },
    { label: "About" },
  ];

  return (
    <>
      <div className="min-h-screen">
        <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center gap-3 border-b border-slate-100">
          <button onClick={() => navigate(-1)} className="text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-slate-900 text-base">Settings</h1>
        </div>

        <div className="p-4 space-y-2">
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="w-full text-left py-4 px-4 bg-white rounded-xl text-quizup-gold text-sm font-display font-bold border border-quizup-gold/30 shadow-sm"
            >
              Quiz admin — topics and questions
            </button>
          )}
          {items.map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full text-left py-4 px-4 bg-white border border-slate-100 rounded-xl text-slate-900 text-sm font-medium shadow-sm flex items-center justify-between active:bg-slate-50"
            >
              {label}
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}

          <button
            onClick={async () => { await logout(); navigate("/"); }}
            className="w-full text-left py-4 px-4 bg-white border border-slate-100 rounded-xl text-quizup-red text-sm font-semibold mt-4 shadow-sm"
          >
            Log Out
          </button>
        </div>
      </div>

      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
    </>
  );
};

export default SettingsPage;
