import type { Match } from "@/types";
import type { BattleCoreState } from "../types";
import type { BattleEvent } from "../types/events";
import { assertPhaseTransition, canHandleEvent } from "../state-machine/transitions";
import { createInitialBattleState } from "./initialState";

function bumpVersion(state: BattleCoreState): BattleCoreState {
  return { ...state, eventVersion: state.eventVersion + 1 };
}

function setPhase(state: BattleCoreState, phase: BattleCoreState["phase"]): BattleCoreState {
  if (!assertPhaseTransition(state.phase, phase)) {
    if (import.meta.env.DEV) {
      console.warn(`[BattleFSM] Illegal phase ${state.phase} → ${phase}`);
    }
    return state;
  }
  return { ...state, phase };
}

/**
 * In the client-side `Match`, `player1` is ALWAYS the local user ("me") and
 * `player2` is the opponent — regardless of which server seat each user holds.
 * The mapping layer has already translated server seat scores into me/opponent
 * before reaching the reducer, so this assignment is direct.
 */
function applyScores(
  match: Match,
  myScore: number,
  opponentScore: number
): Match {
  return {
    ...match,
    player1: { ...match.player1, score: myScore },
    player2: { ...match.player2, score: opponentScore },
  };
}

function deriveRoundResult(
  selectedIndex: number | null,
  correctIndex: number
): BattleCoreState["roundResult"] {
  if (selectedIndex === null || selectedIndex < 0) return "timeout";
  if (selectedIndex === correctIndex) return "correct";
  return "incorrect";
}

/**
 * Pure battle reducer — all transitions are event-driven and auditable.
 * Side effects (socket emit, timers) live in hooks/services, not here.
 */
export function battleReducer(state: BattleCoreState, event: BattleEvent): BattleCoreState {
  if (!canHandleEvent(state, event)) {
    return state;
  }

  switch (event.type) {
    case "RESET":
      return createInitialBattleState(event.match, event.mode);

    case "START_MATCH":
      return bumpVersion(setPhase(state, "intro"));

    case "START_ROUND": {
      const next = setPhase(state, "question");
      return bumpVersion({
        ...next,
        currentQuestion: event.question,
        currentQuestionIndex: event.questionIndex,
        roundEndTimestamp: event.roundEndTimestamp,
        playerAnswer: null,
        opponentAnswer: null,
        roundResult: null,
        answerSubmitted: false,
        match: { ...next.match, totalRounds: event.totalQuestions },
      });
    }

    case "SUBMIT_ANSWER": {
      const q = state.currentQuestion;
      if (!q) return state;
      const isCorrect = event.selectedIndex === q.correctIndex;
      const roundResult = deriveRoundResult(event.selectedIndex, q.correctIndex);
      let match = state.match;
      if (state.mode === "local" && event.localScoreDelta != null && isCorrect) {
        match = {
          ...match,
          player1: {
            ...match.player1,
            score: match.player1.score + (event.localScoreDelta ?? 0),
          },
        };
      }
      return bumpVersion({
        ...state,
        match,
        playerAnswer: event.selectedIndex,
        roundResult,
        answerSubmitted: true,
      });
    }

    case "OPPONENT_ANSWER": {
      if (state.mode === "local" && event.localOpponentScoreDelta != null) {
        const q = state.currentQuestion;
        const isCorrect =
          q != null && event.selectedIndex === q.correctIndex;
        if (isCorrect) {
          return bumpVersion({
            ...state,
            match: {
              ...state.match,
              player2: {
                ...state.match.player2,
                score: state.match.player2.score + event.localOpponentScoreDelta,
              },
            },
            opponentAnswer: event.selectedIndex,
          });
        }
      }
      return bumpVersion({ ...state, opponentAnswer: event.selectedIndex });
    }

    case "ROUND_TIMEOUT": {
      if (state.playerAnswer !== null) return state;
      return bumpVersion({
        ...state,
        playerAnswer: -1,
        roundResult: "timeout",
        answerSubmitted: true,
      });
    }

    case "SHOW_ANSWER": {
      const { payload } = event;
      const withCorrect = {
        ...payload.question,
        correctIndex: payload.correctIndex,
      };
      const myPick = payload.myAnswer?.selectedIndex ?? null;
      const oppPick = payload.opponentAnswer?.selectedIndex ?? null;
      return bumpVersion({
        ...setPhase(state, "answer_reveal"),
        match: applyScores(state.match, payload.myScore, payload.opponentScore),
        currentQuestion: withCorrect,
        playerAnswer: myPick === null ? -1 : myPick,
        opponentAnswer: oppPick,
        roundResult: deriveRoundResult(myPick, payload.correctIndex),
      });
    }

    case "NEXT_ROUND":
      return state;

    case "END_MATCH":
      return bumpVersion({
        ...setPhase(state, "match_end"),
        match: applyScores(state.match, event.myScore, event.opponentScore),
        winnerId: event.winnerId,
        myMatchResult: event.myMatchResult ?? state.myMatchResult,
        roundEndTimestamp: null,
      });

    case "PLAYER_DISCONNECTED":
      return bumpVersion({ ...state, connection: "opponent_disconnected" });

    case "RECONNECT_PLAYER":
      return bumpVersion({ ...state, connection: "connected" });

    case "SYNC_SCORES":
      return bumpVersion({
        ...state,
        match: applyScores(state.match, event.myScore, event.opponentScore),
      });

    default:
      return state;
  }
}
