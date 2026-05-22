import type { Match } from "@/types";
import type { BattleCoreState, BattleMode } from "../types";

export function createInitialBattleState(match: Match, mode: BattleMode): BattleCoreState {
  return {
    mode,
    phase: "intro",
    match,
    currentQuestion: null,
    currentQuestionIndex: -1,
    roundEndTimestamp: null,
    playerAnswer: null,
    opponentAnswer: null,
    roundResult: null,
    winnerId: null,
    myMatchResult: null,
    answerSubmitted: false,
    connection: "connected",
    eventVersion: 0,
  };
}

export function createIdleState(match: Match, mode: BattleMode): BattleCoreState {
  return { ...createInitialBattleState(match, mode), phase: "idle" };
}
