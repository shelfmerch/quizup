import type { BattleCoreState, BattleViewState } from "../types";
import {
  getRoundPercentRemaining,
  getRoundRemainingSec,
} from "../timers/roundClock";

/** Merge derived timer fields for UI — avoids reducer updates every 250ms. */
export function selectBattleViewState(
  core: BattleCoreState | null,
  clockTick: number
): BattleViewState | null {
  if (!core) return null;
  void clockTick;
  const timeLimitSec = core.currentQuestion?.timeLimit ?? 0;
  const timeRemaining = getRoundRemainingSec(core.roundEndTimestamp);
  const percentRemaining = getRoundPercentRemaining(
    core.roundEndTimestamp,
    timeLimitSec
  );
  return {
    ...core,
    timeRemaining,
    timeLimitSec,
    percentRemaining,
  };
}

export function getWinnerFromState(
  core: BattleCoreState | null,
  myUserId?: string,
  opponentUserId?: string
): "player" | "opponent" | "draw" {
  if (!core) return "draw";
  if (core.winnerId && myUserId && opponentUserId) {
    if (core.winnerId === myUserId) return "player";
    if (core.winnerId === opponentUserId) return "opponent";
    return "draw";
  }
  const { player1, player2 } = core.match;
  if (player1.score > player2.score) return "player";
  if (player2.score > player1.score) return "opponent";
  return "draw";
}

import type { BattleState } from "@/types";

/** Legacy shape for components still typed against `@/types`. */
export function toLegacyBattleState(view: BattleViewState | null): BattleState | null {
  if (!view) return null;
  const phase =
    view.phase === "idle" ? "intro" : view.phase;
  return {
    match: view.match,
    currentQuestion: view.currentQuestion,
    currentQuestionIndex: view.currentQuestionIndex,
    timeRemaining: view.timeRemaining,
    playerAnswer: view.playerAnswer,
    opponentAnswer: view.opponentAnswer,
    roundResult: view.roundResult,
    phase,
  };
}
