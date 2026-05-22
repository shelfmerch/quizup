import type { BattleCoreState, BattlePhase } from "../types";
import type { BattleEvent } from "../types/events";

/** Legal phase adjacency — impossible transitions are rejected in the reducer. */
export const PHASE_TRANSITIONS: Record<BattlePhase, readonly BattlePhase[]> = {
  idle: ["intro", "question"],
  intro: ["question", "match_end"],
  question: ["answer_reveal"],
  answer_reveal: ["question", "match_end"],
  match_end: [],
} as const;

export function canTransitionPhase(from: BattlePhase, to: BattlePhase): boolean {
  if (from === to) return true;
  return PHASE_TRANSITIONS[from].includes(to);
}

export function assertPhaseTransition(from: BattlePhase, to: BattlePhase): boolean {
  return canTransitionPhase(from, to);
}

/** Event guards — centralize invalid / duplicate handling. */
export function canHandleEvent(state: BattleCoreState, event: BattleEvent): boolean {
  switch (event.type) {
    case "RESET":
      return true;
    case "START_MATCH":
      return state.phase === "idle" || state.phase === "intro";
    case "START_ROUND":
      return (
        state.phase === "intro" ||
        state.phase === "answer_reveal" ||
        (state.phase === "question" && event.questionIndex !== state.currentQuestionIndex)
      );
    case "SUBMIT_ANSWER":
      return state.phase === "question" && !state.answerSubmitted && state.playerAnswer === null;
    case "OPPONENT_ANSWER":
      return state.phase === "question" && state.opponentAnswer === null;
    case "ROUND_TIMEOUT":
      return state.phase === "question";
    case "SHOW_ANSWER":
      return state.phase === "question" || state.phase === "answer_reveal";
    case "NEXT_ROUND":
      return state.phase === "answer_reveal";
    case "END_MATCH":
      return state.phase !== "idle";
    case "PLAYER_DISCONNECTED":
      return state.phase !== "match_end" && state.phase !== "idle";
    case "RECONNECT_PLAYER":
      return true;
    case "SYNC_SCORES":
      return true;
    default:
      return false;
  }
}
