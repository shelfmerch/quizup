import React, { useEffect, useState } from "react";
import { leaderboardService } from "@/services/leaderboardService";
import { LeaderboardEntry } from "@/types";
import { Search } from "lucide-react";

const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardService.getGlobalLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-quizup-dark px-4 pt-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-quizup-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-quizup-dark">
      {/* Header */}
      <div className="quizup-header-teal px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-foreground text-base">Leaderboard</h1>
        <button><Search className="w-5 h-5 text-foreground/80" /></button>
      </div>

      {/* Top 3 */}
      <div className="bg-quizup-card p-4">
        <div className="flex items-end justify-center gap-4 h-32">
          {/* 2nd place */}
          {entries[1] && (
            <div className="flex flex-col items-center">
              <img src={entries[1].avatarUrl} alt="" className="w-12 h-12 rounded-full border-2 mb-1" style={{borderColor: 'silver'}} />
              <p className="text-[10px] text-foreground font-semibold truncate max-w-[60px]">{entries[1].username}</p>
              <p className="text-xs text-muted-foreground">{entries[1].score}</p>
              <div className="w-16 h-16 quizup-header-teal rounded-t-lg mt-1 flex items-center justify-center">
                <span className="text-xl">{medals[1]}</span>
              </div>
            </div>
          )}
          {/* 1st place */}
          {entries[0] && (
            <div className="flex flex-col items-center">
              <img src={entries[0].avatarUrl} alt="" className="w-14 h-14 rounded-full border-2 mb-1" style={{borderColor: 'gold'}} />
              <p className="text-[10px] text-foreground font-semibold truncate max-w-[60px]">{entries[0].username}</p>
              <p className="text-xs text-muted-foreground">{entries[0].score}</p>
              <div className="w-16 h-24 rounded-t-lg mt-1 flex items-center justify-center" style={{backgroundColor: 'hsl(45 100% 51%)'}}>
                <span className="text-2xl">{medals[0]}</span>
              </div>
            </div>
          )}
          {/* 3rd place */}
          {entries[2] && (
            <div className="flex flex-col items-center">
              <img src={entries[2].avatarUrl} alt="" className="w-12 h-12 rounded-full border-2 mb-1" style={{borderColor: '#cd7f32'}} />
              <p className="text-[10px] text-foreground font-semibold truncate max-w-[60px]">{entries[2].username}</p>
              <p className="text-xs text-muted-foreground">{entries[2].score}</p>
              <div className="w-16 h-12 quizup-header-orange rounded-t-lg mt-1 flex items-center justify-center">
                <span className="text-xl">{medals[2]}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rest of the leaderboard */}
      <div className="px-4 py-3 space-y-2">
        {entries.slice(3).map((entry) => (
          <div key={entry.userId} className="flex items-center gap-3 bg-quizup-card rounded-lg px-4 py-3">
            <span className="text-sm font-display font-extrabold text-muted-foreground w-6 text-center">{entry.rank}</span>
            <img src={entry.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{entry.username}</p>
              <p className="text-[10px] text-muted-foreground">Lvl {entry.level} · {entry.country}</p>
            </div>
            <p className="font-display font-extrabold text-sm text-quizup-gold">{entry.score}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
