import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getLeagueFromXp, LEAGUES, leagueBadgeSrc } from "@/lib/progression";

export type { LeagueKey, League } from "@/lib/progression";
export { LEAGUES, getLeagueFromXp, leagueBadgeSrc } from "@/lib/progression";

interface LeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current `users.xp` */
  currentXp?: number;
}

export const LeagueModal: React.FC<LeagueModalProps> = ({ isOpen, onClose, currentXp = 0 }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const xp = typeof currentXp === "number" && Number.isFinite(currentXp) ? Math.max(0, Math.floor(currentXp)) : 0;
  const currentLeague = getLeagueFromXp(xp);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      setTimeout(() => {
        if (!scrollRef.current) return;
        const idx = LEAGUES.findIndex((l) => l.key === currentLeague.key);
        if (idx !== -1) {
          const containerWidth = scrollRef.current.clientWidth;
          const cardWidth = 240;
          const gap = 24;
          const scrollLeft =
            idx * (cardWidth + gap) - containerWidth / 2 + cardWidth / 2 + 40;
          scrollRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
        }
      }, 100);
    }
  }, [isOpen, currentLeague]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg overflow-hidden pt-10 pb-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2 z-10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-4xl font-display font-black text-white drop-shadow-md">Leagues</h2>
          <p className="text-white/80 font-medium mt-2 text-sm uppercase tracking-widest">
            Earn XP to climb the ranks!
          </p>
        </div>

        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory px-10 gap-6 pb-8 pt-9 custom-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {LEAGUES.map((league) => {
            const isCurrent = league.key === currentLeague.key;
            const isLocked = xp < league.minXpInclusive;
            const isCompleted = xp >= league.minXpInclusive && !isCurrent;

            return (
              <div
                key={league.key}
                className={`snap-center shrink-0 w-[240px] rounded-[2rem] p-6 flex flex-col items-center justify-center relative transition-all duration-500 ${isCurrent ? "scale-110 shadow-[0_0_40px_rgba(255,255,255,0.2)] bg-gradient-to-b from-white/20 to-white/5 border-2 border-white/50" : "scale-95 bg-white/10 border border-white/10 opacity-60 hover:opacity-100"}`}
                style={{ backdropFilter: "blur(16px)" }}
              >
                {isCurrent && (
                  <div className="absolute -top-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1 rounded-full shadow-lg">
                    Current
                  </div>
                )}
                {isCompleted && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border border-green-500/50">
                    ✓
                  </div>
                )}

                <div
                  className={`relative w-36 h-36 mb-6 flex items-center justify-center transition-all ${isLocked ? "grayscale opacity-30" : "drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"}`}
                >
                  <img
                    src={leagueBadgeSrc(league.badgeUrl)}
                    alt={league.name}
                    className={`max-w-full max-h-full object-contain ${isCurrent ? "animate-pulse-slow" : ""}`}
                  />
                </div>

                <h3
                  className={`text-2xl font-display font-black tracking-widest uppercase ${isLocked ? "text-white/40" : "text-white"} drop-shadow-md`}
                >
                  {league.name}
                </h3>

                <div className="mt-6 bg-black/40 rounded-2xl px-4 py-3 w-full text-center border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">
                    Required XP
                  </p>
                  <p
                    className={`text-xl font-black font-mono tracking-tight ${isCurrent ? "text-amber-400" : isLocked ? "text-white/40" : "text-green-400"}`}
                  >
                    {league.minXpInclusive.toLocaleString()}
                  </p>
                </div>

                {isLocked && (
                  <div className="mt-4 text-xs font-bold text-white/30 uppercase tracking-wider">
                    Locked
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
