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
  currentQuestion: Question
): BattleEvent {
  return {
    type: "SHOW_ANSWER",
    payload: {
      correctIndex: payload.correctIndex,
      player1Score: payload.player1Score,
      player2Score: payload.player2Score,
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
    player1Score: payload.player1.score,
    player2Score: payload.player2.score,
    myMatchResult,
  };
}
