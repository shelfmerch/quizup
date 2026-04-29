import React, { useEffect, useState } from "react";
import { leaderboardService } from "@/services/leaderboardService";
import { LeaderboardEntry } from "@/types";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
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
      <div className="min-h-screen px-4 pt-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-white/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center justify-between border-b border-white/50">
        <h1 className="font-display font-bold text-slate-900 text-base">Leaderboard</h1>
        <button><Search className="w-5 h-5 text-slate-500" /></button>
      </div>

      {/* Top 3 */}
      <div className="bg-white/30 backdrop-blur-md p-6 border-b border-white/50">
        <div className="flex items-end justify-center gap-4 h-36">
          {/* 2nd place */}
          {entries[1] && (
            <button onClick={() => navigate(`/profile/${entries[1].userId}`)} className="flex flex-col items-center">
              <img src={entries[1].avatarUrl} alt="" className="w-12 h-12 rounded-full border-2 mb-2 shadow-md" style={{borderColor: 'silver'}} />
              <p className="text-[10px] text-slate-900 font-bold truncate max-w-[60px]">{entries[1].username}</p>
              <p className="text-[10px] text-slate-500 font-bold">{entries[1].score}</p>
              <div className="w-16 h-16 btn-gradient-blue rounded-t-2xl mt-2 flex items-center justify-center shadow-lg">
                <span className="text-xl">{medals[1]}</span>
              </div>
            </button>
          )}
          {/* 1st place */}
          {entries[0] && (
            <button onClick={() => navigate(`/profile/${entries[0].userId}`)} className="flex flex-col items-center">
              <img src={entries[0].avatarUrl} alt="" className="w-16 h-16 rounded-full border-4 mb-2 shadow-xl" style={{borderColor: 'gold'}} />
              <p className="text-[10px] text-slate-900 font-bold truncate max-w-[60px]">{entries[0].username}</p>
              <p className="text-[10px] text-slate-500 font-bold">{entries[0].score}</p>
              <div className="w-20 h-28 btn-gradient-purple rounded-t-2xl mt-2 flex items-center justify-center shadow-xl">
                <span className="text-3xl">{medals[0]}</span>
              </div>
            </button>
          )}
          {/* 3rd place */}
          {entries[2] && (
            <button onClick={() => navigate(`/profile/${entries[2].userId}`)} className="flex flex-col items-center">
              <img src={entries[2].avatarUrl} alt="" className="w-12 h-12 rounded-full border-2 mb-2 shadow-md" style={{borderColor: '#cd7f32'}} />
              <p className="text-[10px] text-slate-900 font-bold truncate max-w-[60px]">{entries[2].username}</p>
              <p className="text-[10px] text-slate-500 font-bold">{entries[2].score}</p>
              <div className="w-16 h-12 btn-gradient-red rounded-t-2xl mt-2 flex items-center justify-center shadow-lg">
                <span className="text-xl">{medals[2]}</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Rest of the leaderboard */}
      <div className="px-4 py-3 space-y-2">
        {entries.slice(3).map((entry) => (
          <button
            key={entry.userId}
            onClick={() => navigate(`/profile/${entry.userId}`)}
            className="w-full flex items-center gap-3 bg-white/70 backdrop-blur-sm border border-white rounded-2xl px-4 py-3 text-left active:opacity-70 transition-all hover:scale-[1.02] shadow-sm"
          >
            <span className="text-sm font-display font-extrabold text-slate-400 w-6 text-center">{entry.rank}</span>
            <img src={entry.avatarUrl} alt="" className="w-10 h-10 rounded-full border border-slate-100 shadow-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{entry.username}</p>
              <p className="text-[10px] text-slate-500 font-medium tracking-tight">Level {entry.level} · {entry.country}</p>
            </div>
            <p className="font-display font-extrabold text-base text-purple-600">{entry.score}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
