// TODO: replace with Socket.io battle events + server-side timer
import { BattleState, Match, Question } from "@/types";

export type BattleEventHandler = (state: BattleState) => void;

export const battleService = {
  createInitialState(match: Match): BattleState {
    return {
      match,
      currentQuestion: null,
      currentQuestionIndex: -1,
      timeRemaining: 0,
      playerAnswer: null,
      opponentAnswer: null,
      roundResult: null,
      phase: "intro",
    };
  },

  getNextQuestion(state: BattleState): BattleState {
    const nextIndex = state.currentQuestionIndex + 1;
    if (nextIndex >= state.match.questions.length) {
      return { ...state, phase: "match_end" };
    }
    return {
      ...state,
      currentQuestion: state.match.questions[nextIndex],
      currentQuestionIndex: nextIndex,
      timeRemaining: state.match.questions[nextIndex].timeLimit,
      playerAnswer: null,
      opponentAnswer: null,
      roundResult: null,
      phase: "question",
    };
  },

  submitAnswer(state: BattleState, selectedIndex: number): BattleState {
    if (state.playerAnswer !== null || !state.currentQuestion) return state;

    const isCorrect = selectedIndex === state.currentQuestion.correctIndex;
    const updatedMatch = { ...state.match };
    const timeBonus = Math.max(0, state.timeRemaining);
    const points = isCorrect ? 100 + timeBonus * 10 : 0;
    updatedMatch.player1 = {
      ...updatedMatch.player1,
      score: updatedMatch.player1.score + points,
    };

    return {
      ...state,
      match: updatedMatch,
      playerAnswer: selectedIndex,
      roundResult: isCorrect ? "correct" : "incorrect",
    };
  },

  applyOpponentAnswer(state: BattleState, selectedIndex: number): BattleState {
    if (!state.currentQuestion) return state;

    const isCorrect = selectedIndex === state.currentQuestion.correctIndex;
    const updatedMatch = { ...state.match };
    const points = isCorrect ? 100 + Math.floor(Math.random() * 80) : 0;
    updatedMatch.player2 = {
      ...updatedMatch.player2,
      score: updatedMatch.player2.score + points,
    };

    return {
      ...state,
      match: updatedMatch,
      opponentAnswer: selectedIndex,
    };
  },

  handleTimeout(state: BattleState): BattleState {
    if (state.playerAnswer !== null) return state;
    return {
      ...state,
      playerAnswer: -1,
      roundResult: "timeout",
    };
  },

  getWinner(state: BattleState): "player" | "opponent" | "draw" {
    const { player1, player2 } = state.match;
    if (player1.score > player2.score) return "player";
    if (player2.score > player1.score) return "opponent";
    return "draw";
  },
};
