import type { Match, MatchPlayer, Question } from "@/types";

/** Canonical battle phases — single source of truth for FSM. */
export type BattlePhase = "idle" | "intro" | "question" | "answer_reveal" | "match_end";

export type RoundResult = "waiting" | "correct" | "incorrect" | "timeout" | null;

export type BattleMode = "local" | "online";

export type ConnectionStatus = "connected" | "reconnecting" | "opponent_disconnected";

/** Per-player breakdown at match end (server payload). */
export interface MatchResultData {
  matchScore: number;
  levelBonus: number;
  finalPoints: number;
  xpGained: number;
  xpPenalty: number;
  netXp: number;
}

/** Server round answer slice (online). */
export interface ServerRoundAnswer {
  selectedIndex: number | null;
  isCorrect: boolean;
  points: number;
}

export interface RoundResultPayload {
  correctIndex: number;
  player1Score: number;
  player2Score: number;
  myAnswer: ServerRoundAnswer | null;
  opponentAnswer: ServerRoundAnswer | null;
}

/**
 * Core reducer state — authoritative game facts only.
 * Do NOT store `timeRemaining` here; derive from `roundEndTimestamp`.
 */
export interface BattleCoreState {
  mode: BattleMode;
  phase: BattlePhase;
  match: Match;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  /** Server-authoritative epoch ms when the active round closes. */
  roundEndTimestamp: number | null;
  playerAnswer: number | null;
  opponentAnswer: number | null;
  roundResult: RoundResult;
  winnerId: string | null;
  myMatchResult: MatchResultData | null;
  /** Prevents duplicate submissions and stale socket replays. */
  answerSubmitted: boolean;
  connection: ConnectionStatus;
  /** Monotonic version for ordering out-of-order socket events. */
  eventVersion: number;
}

/** View model consumed by UI — extends core with derived clock fields. */
export interface BattleViewState extends BattleCoreState {
  timeRemaining: number;
  timeLimitSec: number;
  percentRemaining: number;
}

export type { Match, MatchPlayer, Question };
