/** Client → server */
export const BATTLE_CLIENT_EVENTS = {
  JOIN_MATCH_ROOM: "join_match_room",
  SUBMIT_ANSWER: "submit_answer",
  LEAVE_MATCH: "leave_match",
  RECONNECT_MATCH: "reconnect_match",
} as const;

/** Server → client */
export const BATTLE_SERVER_EVENTS = {
  ROOM_JOINED: "room_joined",
  BATTLE_START: "battle_start",
  QUESTION_START: "question_start",
  ANSWER_RESULT: "answer_result",
  ROUND_END: "round_end",
  MATCH_END: "match_end",
  OPPONENT_DISCONNECTED: "opponent_disconnected",
  MATCH_ABANDONED: "match_abandoned",
  BATTLE_ERROR: "battle_error",
  RECONNECTING_TO: "reconnecting_to",
} as const;

export interface QuestionStartPayload {
  questionIndex: number;
  totalQuestions: number;
  question: {
    id: string;
    text: string;
    options: string[];
    timeLimit: number;
    categoryId?: string;
    imageUrl?: string | null;
  };
  timerEndsAt: number;
}

export interface RoundEndPayload {
  correctIndex: number;
  player1Score: number;
  player2Score: number;
  roundAnswers: Record<
    string,
    { selectedIndex: number | null; isCorrect: boolean; points: number } | null
  >;
}

export interface MatchEndPayload {
  matchId: string;
  winnerId: string | null;
  player1: {
    userId: string;
    score: number;
    levelBonus: number;
    finalPoints: number;
    xpGained: number;
    xpPenalty: number;
    netXp: number;
  };
  player2: {
    userId: string;
    score: number;
    levelBonus: number;
    finalPoints: number;
    xpGained: number;
    xpPenalty: number;
    netXp: number;
  };
  endReason?: string;
}
