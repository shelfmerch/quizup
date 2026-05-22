import { useMemo } from "react";
import type { MatchPlayer } from "@/types";
import { useBattleController } from "@/battle";
import type { MatchResultData, OnlineBattleSession } from "@/battle";

export type { MatchResultData };

export interface OnlineBattleInit {
  matchId: string;
  mySeat: "player1" | "player2";
  myUserId: string;
  opponentUserId: string;
  me: MatchPlayer;
  opponent: MatchPlayer;
  categoryId: string;
  categoryName: string;
  totalRounds: number;
}

function toSession(init: OnlineBattleInit): OnlineBattleSession {
  return {
    matchId: init.matchId,
    mySeat: init.mySeat,
    myUserId: init.myUserId,
    opponentUserId: init.opponentUserId,
    me: init.me,
    opponent: init.opponent,
    categoryId: init.categoryId,
    categoryName: init.categoryName,
    totalRounds: init.totalRounds,
  };
}

/**
 * Online battle — state driven by server socket events mapped to BattleEvent.
 */
export function useOnlineBattle(init: OnlineBattleInit | null) {
  const config = useMemo(
    () => (init ? { mode: "online" as const, session: toSession(init) } : null),
    [init?.matchId, init?.myUserId, init?.opponentUserId]
  );

  const {
    state,
    startNextRound,
    submitAnswer,
    proceedToNext,
    getWinner,
    myMatchResult,
  } = useBattleController(config);

  return {
    state,
    startNextRound,
    submitAnswer,
    proceedToNext,
    getWinner,
    myMatchResult,
  };
}
