import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { Match } from "@/types";
import { getSocket } from "@/services/socketService";
import { matchService } from "@/services/matchService";
import { battleReducer } from "../reducers/battleReducer";
import { createInitialBattleState } from "../reducers/initialState";
import {
  getWinnerFromState,
  selectBattleViewState,
  toLegacyBattleState,
} from "../selectors/battleSelectors";
import {
  buildLocalRoundReveal,
  calcLocalOpponentPoints,
  calcLocalPoints,
  getNextLocalQuestion,
} from "../services/localBattleEngine";
import {
  mapMatchEndToEvent,
  mapQuestionStartToEvent,
  mapRoundEndToEvent,
} from "../socket/mapServerToBattleEvent";
import {
  BATTLE_CLIENT_EVENTS,
  BATTLE_SERVER_EVENTS,
  type MatchEndPayload,
  type QuestionStartPayload,
  type RoundEndPayload,
} from "../socket/battleSocketEvents";
import type { BattleCoreState } from "../types";
import type { BattleEvent } from "../types/events";
import type { OnlineBattleSession } from "../types/session";
import { isRoundExpired } from "../timers/roundClock";
import { useRoundClockTick } from "../timers/useRoundClock";

export type BattleControllerConfig =
  | { mode: "local"; match: Match }
  | { mode: "online"; session: OnlineBattleSession };

function buildOnlineMatch(session: OnlineBattleSession, p1: number, p2: number): Match {
  const myScore = session.mySeat === "player1" ? p1 : p2;
  const oppScore = session.mySeat === "player1" ? p2 : p1;
  return {
    id: session.matchId,
    categoryId: session.categoryId,
    categoryName: session.categoryName,
    player1: { ...session.me, score: myScore },
    player2: { ...session.opponent, score: oppScore },
    status: "in_progress",
    currentRound: 0,
    totalRounds: session.totalRounds,
    questions: [],
    startedAt: new Date().toISOString(),
  };
}

function rootReducer(
  state: BattleCoreState | null,
  event: BattleEvent
): BattleCoreState | null {
  if (event.type === "RESET") {
    return battleReducer(createInitialBattleState(event.match, event.mode), event);
  }
  if (!state) return null;
  return battleReducer(state, event);
}

const REVEAL_MS = 500;
const BETWEEN_ROUNDS_MS = 1200;

/**
 * Unified battle controller — reducer FSM + timestamp clock + socket bridge.
 */
export function useBattleController(config: BattleControllerConfig | null) {
  const [core, dispatch] = useReducer(rootReducer, null);
  const coreRef = useRef(core);
  coreRef.current = core;

  const configRef = useRef(config);
  configRef.current = config;

  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const betweenRoundsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutHandledRef = useRef(false);
  /** Question index the player has already submitted an answer for. */
  const submittedForRoundRef = useRef<number>(-1);

  const clearTimers = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (betweenRoundsRef.current) clearTimeout(betweenRoundsRef.current);
    if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    revealTimerRef.current = null;
    betweenRoundsRef.current = null;
    opponentTimerRef.current = null;
  }, []);

  const scheduleLocalReveal = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      const state = coreRef.current;
      if (!state || state.phase !== "question") return;
      const reveal = buildLocalRoundReveal(state);
      const q = state.currentQuestion;
      if (!reveal || !q) return;
      dispatch({
        type: "SHOW_ANSWER",
        payload: {
          ...reveal,
          myAnswer: {
            selectedIndex: state.playerAnswer === -1 ? null : state.playerAnswer,
            isCorrect: state.roundResult === "correct",
            points: 0,
          },
          opponentAnswer: {
            selectedIndex: state.opponentAnswer,
            isCorrect:
              state.opponentAnswer != null &&
              state.opponentAnswer === q.correctIndex,
            points: 0,
          },
          question: q,
        },
      });
    }, REVEAL_MS);
  }, []);

  const tryAdvanceLocalRound = useCallback(() => {
    const state = coreRef.current;
    if (!state || state.mode !== "local" || state.phase !== "answer_reveal") return;

    if (betweenRoundsRef.current) clearTimeout(betweenRoundsRef.current);
    betweenRoundsRef.current = setTimeout(() => {
      const s = coreRef.current;
      if (!s) return;
      const nextQ = getNextLocalQuestion(s);
      if (!nextQ) {
        dispatch({
          type: "END_MATCH",
          winnerId: null,
          player1Score: s.match.player1.score,
          player2Score: s.match.player2.score,
        });
        return;
      }
      const roundEndTimestamp = Date.now() + nextQ.timeLimit * 1000;
      timeoutHandledRef.current = false;
      submittedForRoundRef.current = -1;
      dispatch({
        type: "START_ROUND",
        questionIndex: s.currentQuestionIndex + 1,
        question: nextQ,
        roundEndTimestamp,
        totalQuestions: s.match.questions.length,
      });
    }, BETWEEN_ROUNDS_MS);
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimers();
    timeoutHandledRef.current = false;
    if (!config) return;

    const matchKey =
      config.mode === "local" ? config.match.id : config.session.matchId;
    const existing = coreRef.current;
    if (
      existing &&
      existing.match.id === matchKey &&
      existing.mode === config.mode &&
      existing.phase !== "idle" &&
      existing.phase !== "intro"
    ) {
      return;
    }

    if (config.mode === "local") {
      dispatch({ type: "RESET", match: config.match, mode: "local" });
      dispatch({ type: "START_MATCH" });
      return;
    }

    const s = config.session;
    dispatch({
      type: "RESET",
      match: buildOnlineMatch(s, 0, 0),
      mode: "online",
    });
    dispatch({ type: "START_MATCH" });
  }, [
    config?.mode,
    config?.mode === "local"
      ? config.match.id
      : config?.mode === "online"
        ? config.session.matchId
        : null,
    clearTimers,
  ]);

  // ── Online socket sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!config || config.mode !== "online") return;

    const session = config.session;
    const socket = getSocket();

    const joinRoom = () => {
      socket.emit(BATTLE_CLIENT_EVENTS.JOIN_MATCH_ROOM, { matchId: session.matchId });
    };

    joinRoom();
    socket.on("connect", joinRoom);

    const onQuestionStart = (payload: QuestionStartPayload) => {
      timeoutHandledRef.current = false;
      submittedForRoundRef.current = -1;
      dispatch(mapQuestionStartToEvent(payload));
    };

    const onRoundEnd = (payload: RoundEndPayload) => {
      timeoutHandledRef.current = true;
      const state = coreRef.current;
      const q = state?.currentQuestion;
      if (!q) return;
      dispatch(
        mapRoundEndToEvent(
          payload,
          session.myUserId,
          session.opponentUserId,
          q
        )
      );
    };

    const onMatchEnd = (payload: MatchEndPayload) => {
      timeoutHandledRef.current = true;
      clearTimers();
      dispatch(mapMatchEndToEvent(payload, session.mySeat));
    };

    const onOpponentDisconnected = (payload: { userId: string }) => {
      dispatch({ type: "PLAYER_DISCONNECTED", userId: payload.userId });
    };

    const onBattleError = (payload: { message?: string }) => {
      console.error("[Battle]", payload.message);
    };

    socket.on(BATTLE_SERVER_EVENTS.QUESTION_START, onQuestionStart);
    socket.on(BATTLE_SERVER_EVENTS.ROUND_END, onRoundEnd);
    socket.on(BATTLE_SERVER_EVENTS.MATCH_END, onMatchEnd);
    socket.on(BATTLE_SERVER_EVENTS.OPPONENT_DISCONNECTED, onOpponentDisconnected);
    socket.on(BATTLE_SERVER_EVENTS.BATTLE_ERROR, onBattleError);

    return () => {
      socket.off("connect", joinRoom);
      socket.off(BATTLE_SERVER_EVENTS.QUESTION_START, onQuestionStart);
      socket.off(BATTLE_SERVER_EVENTS.ROUND_END, onRoundEnd);
      socket.off(BATTLE_SERVER_EVENTS.MATCH_END, onMatchEnd);
      socket.off(BATTLE_SERVER_EVENTS.OPPONENT_DISCONNECTED, onOpponentDisconnected);
      socket.off(BATTLE_SERVER_EVENTS.BATTLE_ERROR, onBattleError);
      clearTimers();
    };
  }, [
    config?.mode === "online" ? config.session.matchId : null,
    config?.mode === "online" ? config.session.myUserId : null,
    clearTimers,
  ]);

  // ── Local: simulated opponent ─────────────────────────────────────────────
  useEffect(() => {
    if (!core || core.mode !== "local" || core.phase !== "question" || !core.currentQuestion) {
      return;
    }

    const opponentResult = matchService.simulateOpponentAnswer(core.currentQuestion);
    opponentTimerRef.current = setTimeout(() => {
      const state = coreRef.current;
      if (!state?.currentQuestion) return;
      const isCorrect =
        opponentResult.selectedIndex === state.currentQuestion.correctIndex;
      dispatch({
        type: "OPPONENT_ANSWER",
        selectedIndex: opponentResult.selectedIndex,
        localOpponentScoreDelta: calcLocalOpponentPoints(isCorrect),
      });
      if (state.playerAnswer !== null || state.answerSubmitted) {
        scheduleLocalReveal();
      }
    }, opponentResult.timeMs);

    return () => {
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    };
  }, [core?.mode, core?.phase, core?.currentQuestionIndex, scheduleLocalReveal]);

  // ── Timestamp timeout (local authority for offline; online is server-driven) ─
  useEffect(() => {
    if (!core || core.phase !== "question" || core.roundEndTimestamp == null) return;

    const check = () => {
      if (timeoutHandledRef.current) return;
      const state = coreRef.current;
      if (!state || state.phase !== "question") return;
      if (!isRoundExpired(state.roundEndTimestamp)) return;

      if (state.mode === "local") {
        timeoutHandledRef.current = true;
        dispatch({ type: "ROUND_TIMEOUT" });
        scheduleLocalReveal();
      }
    };

    check();
    const id = window.setInterval(check, 200);
    return () => window.clearInterval(id);
  }, [
    core?.phase,
    core?.roundEndTimestamp,
    core?.currentQuestionIndex,
    core?.mode,
    scheduleLocalReveal,
  ]);

  // ── Local: auto-advance after reveal ────────────────────────────────────────
  useEffect(() => {
    if (!core || core.mode !== "local" || core.phase !== "answer_reveal") return;
    tryAdvanceLocalRound();
    return () => {
      if (betweenRoundsRef.current) clearTimeout(betweenRoundsRef.current);
    };
  }, [core?.phase, core?.currentQuestionIndex, core?.mode, tryAdvanceLocalRound]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const clockTick = useRoundClockTick(
    core?.phase,
    core?.currentQuestionIndex ?? -1
  );

  const view = useMemo(
    () => selectBattleViewState(core, clockTick),
    [core, clockTick]
  );

  const legacyState = useMemo(() => toLegacyBattleState(view), [view]);

  const startNextRound = useCallback(() => {
    const state = coreRef.current;
    const cfg = configRef.current;
    if (!state || !cfg || cfg.mode !== "local") return;

    const nextQ =
      state.currentQuestionIndex < 0
        ? state.match.questions[0]
        : getNextLocalQuestion(state);
    if (!nextQ) {
      dispatch({
        type: "END_MATCH",
        winnerId: null,
        player1Score: state.match.player1.score,
        player2Score: state.match.player2.score,
      });
      return;
    }

    const questionIndex =
      state.currentQuestionIndex < 0 ? 0 : state.currentQuestionIndex + 1;
    timeoutHandledRef.current = false;
    submittedForRoundRef.current = -1;
    dispatch({
      type: "START_ROUND",
      questionIndex,
      question: nextQ,
      roundEndTimestamp: Date.now() + nextQ.timeLimit * 1000,
      totalQuestions: state.match.questions.length,
    });
  }, []);

  const submitAnswer = useCallback((selectedIndex: number) => {
    const state = coreRef.current;
    const cfg = configRef.current;
    if (!state || state.phase !== "question" || state.answerSubmitted) return;
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) return;

    // Ref-based lock — survives the gap between two rapid clicks before React
    // re-reads `state.answerSubmitted`.
    if (submittedForRoundRef.current === state.currentQuestionIndex) return;
    submittedForRoundRef.current = state.currentQuestionIndex;

    if (cfg?.mode === "online") {
      dispatch({ type: "SUBMIT_ANSWER", selectedIndex });
      getSocket().emit(BATTLE_CLIENT_EVENTS.SUBMIT_ANSWER, {
        matchId: cfg.session.matchId,
        selectedIndex,
        questionIndex: state.currentQuestionIndex,
      });
      return;
    }

    const q = state.currentQuestion;
    if (!q) return;
    const isCorrect = selectedIndex === q.correctIndex;
    const points = calcLocalPoints(
      isCorrect,
      state.roundEndTimestamp,
      q.timeLimit
    );
    dispatch({
      type: "SUBMIT_ANSWER",
      selectedIndex,
      localScoreDelta: points,
    });
    scheduleLocalReveal();
  }, [scheduleLocalReveal]);

  const proceedToNext = useCallback(() => {
    tryAdvanceLocalRound();
  }, [tryAdvanceLocalRound]);

  const getWinner = useCallback(() => {
    const cfg = configRef.current;
    const state = coreRef.current;
    if (cfg?.mode === "online") {
      return getWinnerFromState(
        state,
        cfg.session.myUserId,
        cfg.session.opponentUserId
      );
    }
    return getWinnerFromState(state);
  }, []);

  const myMatchResult = core?.myMatchResult ?? null;

  return {
    state: legacyState,
    core,
    view,
    dispatch,
    startNextRound,
    submitAnswer,
    proceedToNext,
    getWinner,
    myMatchResult,
  };
}
