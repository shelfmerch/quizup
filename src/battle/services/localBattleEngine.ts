import type { BattleCoreState } from "../types";
import type { Question } from "@/types";

/** Local-only scoring mirror (server uses battleEngine.js in production). */
export function calcLocalPoints(
  isCorrect: boolean,
  roundEndTimestamp: number | null,
  timeLimitSec: number
): number {
  if (!isCorrect || roundEndTimestamp == null) return 0;
  const timeRemainingMs = Math.max(0, roundEndTimestamp - Date.now());
  const timeRemainingSec = Math.ceil(timeRemainingMs / 1000);
  return 100 + timeRemainingSec * 10;
}

export function calcLocalOpponentPoints(isCorrect: boolean): number {
  if (!isCorrect) return 0;
  return 100 + Math.floor(Math.random() * 80);
}

export function buildLocalRoundReveal(state: BattleCoreState): {
  correctIndex: number;
  player1Score: number;
  player2Score: number;
} | null {
  const q = state.currentQuestion;
  if (!q || q.correctIndex < 0) return null;
  return {
    correctIndex: q.correctIndex,
    player1Score: state.match.player1.score,
    player2Score: state.match.player2.score,
  };
}

export function getNextLocalQuestion(state: BattleCoreState): Question | null {
  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex >= state.match.questions.length) return null;
  return state.match.questions[nextIndex];
}
