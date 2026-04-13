import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { Profile } from "@/types";
import { MOCK_ACHIEVEMENTS } from "@/data/mock-data";
import { Settings, LogOut, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    profileService.getProfile("user1").then(setProfile);
  }, []);

  const p = profile || user;
  if (!p) return null;

  const xpPercent = ((p.xp || 0) / (p.xpToNextLevel || 1)) * 100;

  return (
    <div className="min-h-screen bg-quizup-dark">
      {/* Purple header - QuizUp profile style */}
      <div className="quizup-header-purple px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-foreground text-base">{p.displayName || p.username}</h1>
        <div className="flex gap-3">
          <button><Search className="w-5 h-5 text-foreground/80" /></button>
          <button onClick={() => navigate("/settings")}><Settings className="w-5 h-5 text-foreground/80" /></button>
        </div>
      </div>

      {/* Avatar + info */}
      <div className="bg-quizup-card p-6 text-center">
        <div className="relative inline-block mb-3">
          <img src={p.avatarUrl} alt="" className="w-24 h-24 rounded-full border-4 border-quizup-dark" style={{borderColor: 'hsl(270 60% 50%)'}} />
          {/* Level badge */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-quizup-dark rounded-full px-3 py-0.5">
            <span className="text-[10px] font-bold text-quizup-gold">LVL {p.level}</span>
          </div>
        </div>
        <h2 className="font-display font-extrabold text-xl text-foreground">{p.displayName || p.username}</h2>
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
          <div className="h-full quizup-header-purple rounded-full" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Stats - QuizUp style divided row */}
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

      {/* Social */}
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

      {/* Action buttons - QuizUp style */}
      <div className="px-4 py-3 flex gap-2">
        <button className="flex-1 h-11 rounded-lg quizup-header-red text-foreground font-semibold text-sm">
          ⚡ Play
        </button>
        <button className="flex-1 h-11 rounded-lg bg-quizup-surface text-foreground font-semibold text-sm border border-border">
          ✉ Chat
        </button>
      </div>

      {/* Achievements */}
      <div className="px-4 pb-4">
        <h3 className="font-display font-bold text-foreground text-sm uppercase tracking-wider mb-3">Achievements</h3>
        <div className="grid grid-cols-4 gap-2">
          {MOCK_ACHIEVEMENTS.map((a) => (
            <div
              key={a.id}
              className={`bg-quizup-card rounded-lg p-2 text-center border border-border ${!a.isUnlocked ? "opacity-25" : ""}`}
            >
              <span className="text-xl">{a.icon}</span>
              <p className="text-[8px] text-muted-foreground mt-1 truncate">{a.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 pb-6">
        <button
          onClick={async () => { await logout(); navigate("/"); }}
          className="w-full h-11 rounded-lg bg-quizup-card border border-border text-quizup-red font-semibold text-sm"
        >
          Log Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
