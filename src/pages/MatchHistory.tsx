import React, { useEffect, useState } from "react";
import { profileService } from "@/services/profileService";
import { useAuth } from "@/hooks/useAuth";
import { MatchHistoryEntry } from "@/types";
import { Search } from "lucide-react";

const MatchHistory: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setHistory([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    profileService
      .getMatchHistory(user.id, 50)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 pt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-white/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <h1 className="font-display font-bold text-slate-900 text-base">Match History</h1>
        <button><Search className="w-5 h-5 text-slate-500" /></button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {history.map((match) => {
          const isWin = match.result === "win";
          const isLoss = match.result === "loss";
          
          const bgColor = isWin ? "bg-emerald-50" : isLoss ? "bg-red-50" : "bg-slate-50";
          const borderColor = isWin ? "border-emerald-100" : isLoss ? "border-red-100" : "border-slate-200";
          const textColor = isWin ? "text-emerald-600" : isLoss ? "text-red-500" : "text-slate-500";
          const iconClass = isWin ? "quizup-answer-green" : isLoss ? "quizup-answer-red" : "bg-slate-400";
          const label = isWin ? "Victory" : isLoss ? "Lost" : "Draw";

          return (
            <div key={match.matchId} className={`${bgColor} border ${borderColor} rounded-2xl p-3 flex items-center gap-3 shadow-sm transition-transform active:scale-[0.98]`}>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-lg shadow-md shrink-0 ${iconClass}`}>
                {match.result === "win" ? "W" : match.result === "loss" ? "L" : "D"}
              </div>
              <img src={match.opponentAvatar} alt="" className="w-11 h-11 rounded-full border-2 border-white shadow-sm shrink-0 object-cover" />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${textColor}`}>{label}</p>
                <p className="text-[15px] font-bold text-slate-900 truncate leading-tight">{match.opponentName}</p>
                <p className="text-[11px] font-semibold text-slate-500 truncate">{match.categoryName}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-2xl font-display font-black tracking-tighter ${textColor}`}>
                  {match.playerScore} <span className="text-slate-400 text-sm font-bold mx-0.5">-</span> {match.opponentScore}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchHistory;
