// TODO: replace with Socket.io + Redis matchmaking
import { Match, MatchPlayer, Question } from "@/types";
import { MOCK_OPPONENTS, MOCK_QUESTIONS, MOCK_AVATARS } from "@/data/mock-data";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const matchService = {
  async findMatch(categoryId: string): Promise<Match> {
    // Simulate matchmaking delay
    await delay(2000 + Math.random() * 2000);

    const opponent = MOCK_OPPONENTS[Math.floor(Math.random() * MOCK_OPPONENTS.length)];
    const questions = [...(MOCK_QUESTIONS[categoryId] || MOCK_QUESTIONS.science)].sort(() => Math.random() - 0.5).slice(0, 7);

    const match: Match = {
      id: `match_${Date.now()}`,
      categoryId,
      categoryName: categoryId.charAt(0).toUpperCase() + categoryId.slice(1),
      player1: {
        userId: "user1",
        username: "Player1",
        avatarUrl: MOCK_AVATARS[0],
        score: 0,
        answers: [],
        level: 7,
      },
      player2: {
        userId: opponent.userId,
        username: opponent.username,
        avatarUrl: opponent.avatarUrl,
        score: 0,
        answers: [],
        level: opponent.level,
      },
      status: "in_progress",
      currentRound: 0,
      totalRounds: questions.length,
      questions,
      startedAt: new Date().toISOString(),
    };

    return match;
  },

  // TODO: replace with Socket.io event
  simulateOpponentAnswer(question: Question): { selectedIndex: number; timeMs: number } {
    const isCorrect = Math.random() > 0.4;
    const selectedIndex = isCorrect ? question.correctIndex : Math.floor(Math.random() * 4);
    const timeMs = 2000 + Math.random() * 6000;
    return { selectedIndex, timeMs };
  },
};
