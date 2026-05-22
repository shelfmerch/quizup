import type { Match, Question } from "@/types";
import type { MatchResultData, RoundResultPayload } from "./index";

/** All state transitions are expressed as typed events. */
export type BattleEvent =
  | { type: "RESET"; match: Match; mode: "local" | "online" }
  | { type: "START_MATCH" }
  | {
      type: "START_ROUND";
      questionIndex: number;
      question: Question;
      roundEndTimestamp: number;
      totalQuestions: number;
    }
  | { type: "SUBMIT_ANSWER"; selectedIndex: number; /** local only scoring */ localScoreDelta?: number }
  | { type: "OPPONENT_ANSWER"; selectedIndex: number; /** local only */ localOpponentScoreDelta?: number }
  | { type: "ROUND_TIMEOUT" }
  | { type: "SHOW_ANSWER"; payload: RoundResultPayload & { question: Question } }
  | { type: "NEXT_ROUND" }
  | {
      type: "END_MATCH";
      winnerId: string | null;
      player1Score: number;
      player2Score: number;
      myMatchResult?: MatchResultData | null;
    }
  | { type: "PLAYER_DISCONNECTED"; userId: string }
  | { type: "RECONNECT_PLAYER" }
  | { type: "SYNC_SCORES"; player1Score: number; player2Score: number };

export type BattleEventType = BattleEvent["type"];
