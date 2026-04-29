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

      <div className="px-4 py-3 space-y-2">
        {history.map((match) => (
          <div key={match.matchId} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
              match.result === "win" ? "quizup-answer-green" : match.result === "loss" ? "quizup-answer-red" : "quizup-header-teal shadow-md"
            }`}>
              {match.result === "win" ? "W" : match.result === "loss" ? "L" : "D"}
            </div>
            <img src={match.opponentAvatar} alt="" className="w-10 h-10 rounded-full border border-slate-100" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{match.opponentName}</p>
              <p className="text-[10px] text-slate-500">{match.categoryName}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-display font-extrabold text-slate-900">
                {match.playerScore} - {match.opponentScore}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchHistory;
