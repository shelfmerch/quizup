import React, { useEffect, useState } from "react";
import { leaderboardService } from "@/services/leaderboardService";
import { LeaderboardEntry } from "@/types";
import { Info } from "lucide-react";
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
      <div className="min-h-screen px-4 pt-4 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="sticky top-0 z-50 px-5 py-5 flex items-center justify-between bg-[#f4f4f4]/90 backdrop-blur-md">
        <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight">Leaderboard</h1>
        {/* <button className="flex items-center gap-1.5 text-slate-600 text-sm font-semibold hover:text-slate-900 transition-colors">
          How it Works
          <Info className="w-5 h-5 text-purple-600" />
        </button> */}
      </div>

      {/* Top 3 Podium */}
      <div className="relative pt-10 pb-8 flex justify-center items-end px-4 overflow-hidden">
        {/* Subtle background rays/glow for 1st place */}
        <div className="absolute inset-0 pointer-events-none flex justify-center items-center -top-12">
          <div className="w-[300px] h-[300px] bg-gradient-to-tr from-pink-200/40 to-red-300/40 blur-3xl rounded-full"></div>
        </div>

        <div className="flex items-end justify-center gap-4 relative z-10 w-full max-w-sm">
          {/* 2nd Place */}
          {entries[1] && (
            <div 
              className="relative flex flex-col items-center mb-2 cursor-pointer flex-1"
              onClick={() => navigate(`/profile/${entries[1].userId}`)}
            >
              <div className="text-emerald-500 text-xs mb-2">▲</div>
              <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-lg">
                <img src={entries[1].avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] border-white object-cover" />
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-cyan-400 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-sm">2</div>
              </div>
              <p className="mt-4 text-xs sm:text-sm font-bold text-slate-900 truncate w-full text-center px-1">{entries[1].username}</p>
              <p className="text-[10px] font-semibold text-cyan-600 mt-0.5">{entries[1].score}</p>
            </div>
          )}

          {/* 1st Place */}
          {entries[0] && (
            <div 
              className="relative flex flex-col items-center -mt-6 cursor-pointer flex-1"
              onClick={() => navigate(`/profile/${entries[0].userId}`)}
            >
              <div className="text-yellow-500 text-3xl mb-2 drop-shadow-md">👑</div>
              <div className="relative p-[4px] rounded-full bg-gradient-to-tr from-yellow-300 to-orange-500 shadow-xl">
                <img src={entries[0].avatarUrl} alt="" className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white object-cover" />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-yellow-400 text-white font-black text-sm flex items-center justify-center border-2 border-white shadow-md">1</div>
              </div>
              <p className="mt-5 text-sm sm:text-base font-bold text-slate-900 truncate w-full text-center px-1">{entries[0].username}</p>
              <p className="text-xs font-semibold text-yellow-600 mt-0.5">{entries[0].score}</p>
            </div>
          )}

          {/* 3rd Place */}
          {entries[2] && (
            <div 
              className="relative flex flex-col items-center mb-2 cursor-pointer flex-1"
              onClick={() => navigate(`/profile/${entries[2].userId}`)}
            >
              <div className="text-rose-500 text-xs mb-2">▼</div>
              <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 shadow-lg">
                <img src={entries[2].avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-[3px] border-white object-cover" />
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-pink-400 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-sm">3</div>
              </div>
              <p className="mt-4 text-xs sm:text-sm font-bold text-slate-900 truncate w-full text-center px-1">{entries[2].username}</p>
              <p className="text-[10px] font-semibold text-pink-600 mt-0.5">{entries[2].score}</p>
            </div>
          )}
        </div>
      </div>

      {/* User Rank Banner */}
      {/* <div className="px-5 mb-6">
        <div className="w-full bg-gradient-to-r from-purple-500 to-blue-400 rounded-[20px] py-4 px-6 flex items-center justify-between text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-transform cursor-pointer">
          <span className="font-semibold text-sm">You Currently Rank</span>
          <div className="flex items-center gap-3">
            <span className="font-display font-black text-xl">239</span>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-emerald-300 text-xs">▲</span>
            </div>
          </div>
        </div>
      </div> */}

      {/* Rest of the leaderboard */}
      <div className="px-5 pb-8">
        {entries.slice(3).map((entry, idx) => (
          <button
            key={entry.userId}
            onClick={() => navigate(`/profile/${entry.userId}`)}
            className="w-full flex items-center gap-4 py-3 border-b border-slate-200 last:border-0 active:bg-slate-100 transition-colors group"
          >
            <img src={entry.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-200 group-hover:border-slate-300 transition-colors" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-[15px] font-bold text-slate-900 truncate">{entry.username}</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">{entry.score} XP</p>
            </div>
            <div className="flex items-center gap-4 pl-2">
              <span className="font-display font-extrabold text-slate-700 text-lg w-8 text-right">{entry.rank}</span>
              <div className="w-4 flex justify-center">
                {idx % 3 === 0 ? (
                  <span className="text-rose-500 text-xs">▼</span>
                ) : (
                  <span className="text-emerald-500 text-xs">▲</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
