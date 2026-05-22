/**
 * @deprecated Use `@/battle` reducer + useBattleController.
 * Re-exported for legacy imports during migration.
 */
import type { BattleState, Match } from "@/types";
import { createInitialBattleState } from "@/battle/reducers/initialState";
import { battleReducer } from "@/battle/reducers/battleReducer";
import { calcLocalPoints } from "@/battle/services/localBattleEngine";

export type BattleEventHandler = (state: BattleState) => void;

export const battleService = {
  createInitialState(match: Match): BattleState {
    const core = createInitialBattleState(match, "local");
    return {
      match: core.match,
      currentQuestion: core.currentQuestion,
      currentQuestionIndex: core.currentQuestionIndex,
      timeRemaining: 0,
      playerAnswer: core.playerAnswer,
      opponentAnswer: core.opponentAnswer,
      roundResult: core.roundResult,
      phase: core.phase === "idle" ? "intro" : core.phase,
    };
  },

  getNextQuestion(state: BattleState): BattleState {
    const nextIndex = state.currentQuestionIndex + 1;
    if (nextIndex >= state.match.questions.length) {
      return battleReducer(
        {
          ...createInitialBattleState(state.match, "local"),
          phase: "answer_reveal",
          currentQuestionIndex: state.currentQuestionIndex,
          currentQuestion: state.currentQuestion,
          match: state.match,
        },
        {
          type: "END_MATCH",
          winnerId: null,
          player1Score: state.match.player1.score,
          player2Score: state.match.player2.score,
        }
      ) as unknown as BattleState;
    }
    const q = state.match.questions[nextIndex];
    const core = battleReducer(
      {
        ...createInitialBattleState(state.match, "local"),
        phase: "intro",
        match: state.match,
      },
      {
        type: "START_ROUND",
        questionIndex: nextIndex,
        question: q,
        roundEndTimestamp: Date.now() + q.timeLimit * 1000,
        totalQuestions: state.match.questions.length,
      }
    );
    return {
      ...state,
      currentQuestion: core.currentQuestion,
      currentQuestionIndex: core.currentQuestionIndex,
      timeRemaining: q.timeLimit,
      playerAnswer: null,
      opponentAnswer: null,
      roundResult: null,
      phase: "question",
    };
  },

  submitAnswer(state: BattleState, selectedIndex: number): BattleState {
    const core = createInitialBattleState(state.match, "local");
    const merged = {
      ...core,
      phase: "question" as const,
      currentQuestion: state.currentQuestion,
      currentQuestionIndex: state.currentQuestionIndex,
      roundEndTimestamp:
        state.timeRemaining > 0
          ? Date.now() + state.timeRemaining * 1000
          : null,
      match: state.match,
      playerAnswer: state.playerAnswer,
    };
    const q = state.currentQuestion;
    if (!q) return state;
    const isCorrect = selectedIndex === q.correctIndex;
    const next = battleReducer(merged, {
      type: "SUBMIT_ANSWER",
      selectedIndex,
      localScoreDelta: calcLocalPoints(
        isCorrect,
        merged.roundEndTimestamp,
        q.timeLimit
      ),
    });
    return {
      ...state,
      match: next.match,
      playerAnswer: selectedIndex,
      roundResult: next.roundResult,
    };
  },

  applyOpponentAnswer(state: BattleState, selectedIndex: number): BattleState {
    const core = createInitialBattleState(state.match, "local");
    const merged = {
      ...core,
      phase: "question" as const,
      currentQuestion: state.currentQuestion,
      match: state.match,
      opponentAnswer: state.opponentAnswer,
    };
    const q = state.currentQuestion;
    const isCorrect = q != null && selectedIndex === q.correctIndex;
    const next = battleReducer(merged, {
      type: "OPPONENT_ANSWER",
      selectedIndex,
      localOpponentScoreDelta: isCorrect ? 100 + Math.floor(Math.random() * 80) : 0,
    });
    return { ...state, match: next.match, opponentAnswer: selectedIndex };
  },

  handleTimeout(state: BattleState): BattleState {
    const core = createInitialBattleState(state.match, "local");
    const next = battleReducer(
      { ...core, phase: "question", match: state.match, playerAnswer: state.playerAnswer },
      { type: "ROUND_TIMEOUT" }
    );
    return {
      ...state,
      playerAnswer: -1,
      roundResult: next.roundResult,
    };
  },

  getWinner(state: BattleState): "player" | "opponent" | "draw" {
    const { player1, player2 } = state.match;
    if (player1.score > player2.score) return "player";
    if (player2.score > player1.score) return "opponent";
    return "draw";
  },
};
