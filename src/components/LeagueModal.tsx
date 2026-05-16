import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export type LeagueKey = "unranked" | "bronze" | "silver" | "gold" | "crystal" | "master" | "champion" | "titan" | "legend";

export interface League {
  key: LeagueKey;
  name: string;
  minLevel: number;
  minXpInclusive: number;
  badgeUrl: string;
}

export const LEAGUES: League[] = [
  { key: "unranked", name: "Unranked", minLevel: 0, minXpInclusive: 0,     badgeUrl: "/leagues/unranked.png" },
  { key: "bronze",   name: "Bronze",   minLevel: 1, minXpInclusive: 1000,  badgeUrl: "/leagues/bronze.png" },
  { key: "silver",   name: "Silver",   minLevel: 2, minXpInclusive: 2000,  badgeUrl: "/leagues/silver.png" },
  { key: "gold",     name: "Gold",     minLevel: 3, minXpInclusive: 5000,  badgeUrl: "/leagues/gold.png" },
  { key: "crystal",  name: "Crystal",  minLevel: 4, minXpInclusive: 7000,  badgeUrl: "/leagues/crystal.png" },
  { key: "master",   name: "Master",   minLevel: 5, minXpInclusive: 10000, badgeUrl: "/leagues/master.png" },
  { key: "champion", name: "Champion", minLevel: 6, minXpInclusive: 13000, badgeUrl: "/leagues/champion.png" },
  { key: "titan",    name: "Titan",    minLevel: 7, minXpInclusive: 15000, badgeUrl: "/leagues/titan.png" },
  { key: "legend",   name: "Legend",   minLevel: 9, minXpInclusive: 20000, badgeUrl: "/leagues/legend.svg" },
];

export function getLeagueFromXp(xpRaw: unknown): League {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (xp >= LEAGUES[i].minXpInclusive) return LEAGUES[i];
  }
  return LEAGUES[0];
}

function leagueBadgeSrc(badgeUrl: string): string {
  const path = badgeUrl.startsWith("/") ? badgeUrl.slice(1) : badgeUrl;
  return `${import.meta.env.BASE_URL || '/'}${path}`;
}

interface LeagueModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentXp: number;
}

export const LeagueModal: React.FC<LeagueModalProps> = ({ isOpen, onClose, currentXp }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentLeague = getLeagueFromXp(currentXp);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      setTimeout(() => {
        if (!scrollRef.current) return;
        const idx = LEAGUES.findIndex(l => l.key === currentLeague.key);
        if (idx !== -1) {
          // Calculate approx scroll position: card width 240px + gap 24px = 264px
          // Adjust for centering in container
          const containerWidth = scrollRef.current.clientWidth;
          const cardWidth = 240;
          const gap = 24;
          const scrollLeft = (idx * (cardWidth + gap)) - (containerWidth / 2) + (cardWidth / 2) + 40; // +40 for px-10 padding
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
          <p className="text-white/80 font-medium mt-2 text-sm uppercase tracking-widest">Earn XP to climb the ranks!</p>
        </div>

        <div 
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory px-10 gap-6 pb-8 pt-9 custom-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {LEAGUES.map((league) => {
            const isCurrent = league.key === currentLeague.key;
            const isLocked = currentXp < league.minXpInclusive;
            const isCompleted = currentXp >= league.minXpInclusive && !isCurrent;
            
            return (
              <div 
                key={league.key} 
                className={`snap-center shrink-0 w-[240px] rounded-[2rem] p-6 flex flex-col items-center justify-center relative transition-all duration-500 ${isCurrent ? 'scale-110 shadow-[0_0_40px_rgba(255,255,255,0.2)] bg-gradient-to-b from-white/20 to-white/5 border-2 border-white/50' : 'scale-95 bg-white/10 border border-white/10 opacity-60 hover:opacity-100'}`}
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
                
                <div className={`relative w-36 h-36 mb-6 flex items-center justify-center transition-all ${isLocked ? 'grayscale opacity-30' : 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]'}`}>
                  <img src={leagueBadgeSrc(league.badgeUrl)} alt={league.name} className={`max-w-full max-h-full object-contain ${isCurrent ? 'animate-pulse-slow' : ''}`} />
                </div>
                
                <h3 className={`text-2xl font-display font-black tracking-widest uppercase ${isLocked ? 'text-white/40' : 'text-white'} drop-shadow-md`}>
                  {league.name}
                </h3>
                
                <div className="mt-6 bg-black/40 rounded-2xl px-4 py-3 w-full text-center border border-white/5 shadow-inner">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Required XP</p>
                  <p className={`text-xl font-black font-mono tracking-tight ${isCurrent ? 'text-amber-400' : isLocked ? 'text-white/40' : 'text-green-400'}`}>
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
