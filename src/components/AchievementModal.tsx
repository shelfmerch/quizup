import React, { useEffect, useRef, useState } from "react";
import { Calendar, Lock, Share2, Swords, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Achievement } from "@/types";

export interface RarityTier {
  name: string;
  color: string;
  bgGradient: string;
  glowClass: string;
  textClass: string;
  bgSolid: string;
}

export const ACHIEVEMENT_TIERS: Record<string, RarityTier> = {
  legendary: {
    name: "Legendary",
    color: "#eab308",
    bgGradient: "from-amber-400 via-yellow-500 to-amber-600",
    glowClass: "shadow-[0_0_15px_rgba(234,179,8,0.45)] border-amber-400/80",
    textClass: "text-amber-500 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-amber-500",
  },
  epic: {
    name: "Epic",
    color: "#a855f7",
    bgGradient: "from-fuchsia-500 via-purple-600 to-indigo-600",
    glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.45)] border-purple-400/80",
    textClass: "text-purple-500 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-purple-500",
  },
  rare: {
    name: "Rare",
    color: "#3b82f6",
    bgGradient: "from-blue-400 via-indigo-500 to-cyan-500",
    glowClass: "shadow-[0_0_12px_rgba(59,130,246,0.35)] border-blue-400/80",
    textClass: "text-blue-500 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-blue-500",
  },
  common: {
    name: "Common",
    color: "#14b8a6",
    bgGradient: "from-teal-400 to-emerald-500",
    glowClass: "shadow-[0_0_10px_rgba(20,184,166,0.25)] border-teal-400/80",
    textClass: "text-teal-600 font-extrabold tracking-widest uppercase",
    bgSolid: "bg-teal-500",
  },
};

export const ACHIEVEMENT_RARITY_MAP: Record<string, keyof typeof ACHIEVEMENT_TIERS> = {
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

const AchievementBadge: React.FC<{
  src: string;
  icon: string;
  alt: string;
  className?: string;
  isUnlocked?: boolean;
}> = ({ src, icon, alt, className = "h-24 w-24", isUnlocked = true }) => {
  const [errored, setErrored] = useState(false);
  if (errored || !src) {
    return (
      <span className="text-4xl leading-none filter drop-shadow-sm" aria-label={alt}>
        {icon}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain transition-transform duration-300 filter drop-shadow-sm ${
        isUnlocked ? "" : "grayscale opacity-70"
      }`}
      onError={() => setErrored(true)}
    />
  );
};

function achievementBadgeSrc(src: string): string {
  if (!src) return "";
  const path = src.startsWith("/") ? src.slice(1) : src;
  return `${import.meta.env.BASE_URL || "/"}${path}`;
}

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: Achievement[];
  focusId: string | null;
  onPlayNow: () => void;
}

export const AchievementModal: React.FC<AchievementModalProps> = ({
  isOpen,
  onClose,
  achievements,
  focusId,
  onPlayNow,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusAchievement = achievements.find((a) => a.id === focusId) ?? achievements[0];

  useEffect(() => {
    if (isOpen && scrollRef.current && focusId) {
      setTimeout(() => {
        if (!scrollRef.current) return;
        const idx = achievements.findIndex((a) => a.id === focusId);
        if (idx === -1) return;
        const containerWidth = scrollRef.current.clientWidth;
        const cardWidth = 240;
        const gap = 24;
        const scrollLeft = idx * (cardWidth + gap) - containerWidth / 2 + cardWidth / 2 + 40;
        scrollRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
      }, 100);
    }
  }, [isOpen, focusId, achievements]);

  if (!isOpen || !focusAchievement) return null;

  const handleShare = (a: Achievement) => {
    if (navigator.share) {
      navigator
        .share({
          title: `Unlocked Achievement: ${a.name}!`,
          text: `I just unlocked the "${a.name}" achievement in Quiz Blitz Arena! Can you beat my score?`,
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(`I just unlocked the "${a.name}" achievement in Quiz Blitz Arena!`);
      toast.success("Copied share message to clipboard!");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg overflow-hidden pt-10 pb-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2 z-10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-4xl font-display font-black text-white drop-shadow-md">Achievements</h2>
          <p className="text-white/80 font-medium mt-2 text-sm uppercase tracking-widest">
            Battle, win, and collect them all!
          </p>
        </div>

        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory px-10 gap-6 pb-8 pt-9 custom-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {achievements.map((a) => {
            const isFocused = a.id === focusId;
            const isUnlocked = a.isUnlocked;
            const isLocked = !isUnlocked;
            const rarityKey = ACHIEVEMENT_RARITY_MAP[a.id] || "common";
            const tier = ACHIEVEMENT_TIERS[rarityKey];

            return (
              <div
                key={a.id}
                className={`snap-center shrink-0 w-[240px] rounded-[2rem] p-6 flex flex-col items-center justify-center relative transition-all duration-500 ${
                  isFocused
                    ? "scale-110 shadow-[0_0_40px_rgba(255,255,255,0.2)] bg-gradient-to-b from-white/20 to-white/5 border-2 border-white/50"
                    : "scale-95 bg-white/10 border border-white/10 opacity-60 hover:opacity-100"
                }`}
                style={{ backdropFilter: "blur(16px)" }}
              >
                {isFocused && (
                  <div className="absolute -top-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1 rounded-full shadow-lg">
                    Viewing
                  </div>
                )}
                {isUnlocked && !isFocused && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border border-green-500/50">
                    ✓
                  </div>
                )}

                <div
                  className={`relative w-36 h-36 mb-6 flex items-center justify-center transition-all ${
                    isLocked ? "grayscale opacity-30" : "drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  <AchievementBadge
                    src={achievementBadgeSrc(a.src)}
                    icon={a.icon}
                    alt={a.name}
                    className="max-h-32 max-w-32"
                    isUnlocked={isUnlocked}
                  />
                </div>

                <span
                  className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${
                    isLocked ? "text-white/30" : "text-amber-300/90"
                  }`}
                >
                  {tier.name}
                </span>

                <h3
                  className={`text-xl font-display font-black tracking-wide text-center leading-tight ${
                    isLocked ? "text-white/40" : "text-white"
                  } drop-shadow-md`}
                >
                  {a.name}
                </h3>

                <div className="mt-4 bg-black/40 rounded-2xl px-4 py-3 w-full text-center border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">
                    {isUnlocked ? "Earned" : "Requirement"}
                  </p>
                  {isUnlocked && a.unlockedAt ? (
                    <p className="text-sm font-bold text-green-400 flex items-center justify-center gap-1">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {new Date(a.unlockedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                  ) : (
                    <p
                      className={`text-xs font-semibold leading-snug ${
                        isFocused ? "text-white/80" : "text-white/40"
                      }`}
                    >
                      {a.description}
                    </p>
                  )}
                </div>

                {isLocked && (
                  <div className="mt-4 text-xs font-bold text-white/30 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
                  </div>
                )}

                {isFocused && (
                  <div className="w-full mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-10 rounded-xl border border-white/20 text-white/90 bg-white/10 font-bold text-xs hover:bg-white/20 transition active:scale-[0.98]"
                    >
                      Close
                    </button>
                    {isUnlocked ? (
                      <button
                        type="button"
                        onClick={() => handleShare(a)}
                        className="h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-md"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onPlayNow}
                        className="h-10 rounded-xl bg-white/90 hover:bg-white text-slate-900 font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-md"
                      >
                        <Swords className="h-3.5 w-3.5" />
                        Play Now
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export { AchievementBadge };
