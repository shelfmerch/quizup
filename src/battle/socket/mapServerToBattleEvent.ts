import type { Question } from "@/types";
import { resolveQuestionImageUrl } from "@/lib/mediaUrl";
import type { BattleEvent } from "../types/events";
import type { MatchResultData } from "../types";
import type {
  MatchEndPayload,
  QuestionStartPayload,
  RoundEndPayload,
} from "./battleSocketEvents";

export function serverQuestionToClient(q: QuestionStartPayload["question"]): Question {
  const resolved = resolveQuestionImageUrl(q.imageUrl ?? undefined);
  return {
    id: q.id,
    categoryId: q.categoryId ?? "",
    text: q.text,
    options: q.options,
    correctIndex: -1,
    timeLimit: q.timeLimit,
    ...(resolved ? { imageUrl: resolved } : {}),
  };
}

export function mapQuestionStartToEvent(payload: QuestionStartPayload): BattleEvent {
  return {
    type: "START_ROUND",
    questionIndex: payload.questionIndex,
    question: serverQuestionToClient(payload.question),
    roundEndTimestamp: payload.timerEndsAt,
    totalQuestions: payload.totalQuestions,
  };
}

export function mapRoundEndToEvent(
  payload: RoundEndPayload,
  myUserId: string,
  opponentUserId: string,
  mySeat: "player1" | "player2",
  currentQuestion: Question
): BattleEvent {
  // Server emits scores keyed by SEAT; translate to me/opponent for the reducer.
  const myScore =
    mySeat === "player1" ? payload.player1Score : payload.player2Score;
  const opponentScore =
    mySeat === "player1" ? payload.player2Score : payload.player1Score;

  return {
    type: "SHOW_ANSWER",
    payload: {
      correctIndex: payload.correctIndex,
      myScore,
      opponentScore,
      myAnswer: payload.roundAnswers[myUserId] ?? null,
      opponentAnswer: payload.roundAnswers[opponentUserId] ?? null,
      question: currentQuestion,
    },
  };
}

export function mapMatchEndToEvent(
  payload: MatchEndPayload,
  mySeat: "player1" | "player2"
): BattleEvent {
  const mySlot = mySeat === "player1" ? payload.player1 : payload.player2;
  const oppSlot = mySeat === "player1" ? payload.player2 : payload.player1;
  const myMatchResult: MatchResultData = {
    matchScore: mySlot.score,
    levelBonus: mySlot.levelBonus,
    finalPoints: mySlot.finalPoints,
    xpGained: mySlot.xpGained,
    xpPenalty: mySlot.xpPenalty,
    netXp: mySlot.netXp,
  };
  return {
    type: "END_MATCH",
    winnerId: payload.winnerId,
    myScore: mySlot.score,
    opponentScore: oppSlot.score,
    myMatchResult,
  };
}
