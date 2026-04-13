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
      <div className="min-h-screen bg-quizup-dark px-4 pt-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-quizup-card rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-quizup-dark">
      <div className="quizup-header-teal px-4 py-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-foreground text-base">Match History</h1>
        <button><Search className="w-5 h-5 text-foreground/80" /></button>
      </div>

      <div className="px-4 py-3 space-y-2">
        {history.map((match) => (
          <div key={match.matchId} className="bg-quizup-card rounded-lg p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-foreground font-bold text-sm ${
              match.result === "win" ? "quizup-answer-green" : match.result === "loss" ? "quizup-answer-red" : "quizup-header-teal"
            }`}>
              {match.result === "win" ? "W" : match.result === "loss" ? "L" : "D"}
            </div>
            <img src={match.opponentAvatar} alt="" className="w-10 h-10 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{match.opponentName}</p>
              <p className="text-[10px] text-muted-foreground">{match.categoryName}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-display font-extrabold text-foreground">
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
