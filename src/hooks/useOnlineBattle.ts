import { useState, useEffect, useCallback, useRef } from "react";
import { BattleState, Match, MatchPlayer, Question } from "@/types";
import { getSocket } from "@/services/socketService";
import { resolveQuestionImageUrl } from "@/lib/mediaUrl";

export interface OnlineBattleInit {
  matchId: string;
  mySeat: "player1" | "player2";
  myUserId: string;
  opponentUserId: string;
  me: MatchPlayer;
  opponent: MatchPlayer;
  categoryId: string;
  categoryName: string;
  totalRounds: number;
}

function serverQuestionToClient(q: {
  id: string;
  text: string;
  options: string[];
  timeLimit: number;
  categoryId?: string;
  imageUrl?: string | null;
}): Question {
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

/** UI always shows `me` on the left (player1) and opponent on the right (player2). */
function buildMatchFromServerScores(
  base: OnlineBattleInit,
  serverP1Score: number,
  serverP2Score: number
): Match {
  const myScore = base.mySeat === "player1" ? serverP1Score : serverP2Score;
  const oppScore = base.mySeat === "player1" ? serverP2Score : serverP1Score;
  return {
    id: base.matchId,
    categoryId: base.categoryId,
    categoryName: base.categoryName,
    player1: { ...base.me, score: myScore },
    player2: { ...base.opponent, score: oppScore },
    status: "in_progress",
    currentRound: 0,
    totalRounds: base.totalRounds,
    questions: [],
    startedAt: new Date().toISOString(),
  };
}

function initialOnlineState(i: OnlineBattleInit): BattleState {
  return {
    match: buildMatchFromServerScores(i, 0, 0),
    currentQuestion: null,
    currentQuestionIndex: -1,
    timeRemaining: 0,
    playerAnswer: null,
    opponentAnswer: null,
    roundResult: null,
    phase: "intro",
  };
}

export function useOnlineBattle(init: OnlineBattleInit | null) {
  const [state, setState] = useState<BattleState | null>(() => (init ? initialOnlineState(init) : null));
  const winnerIdRef = useRef<string | null>(null);
  const initRef = useRef(init);
  const timerEndsAtRef = useRef<number | null>(null);
  initRef.current = init;

  useEffect(() => {
    if (!init) {
      setState(null);
      return;
    }

    winnerIdRef.current = null;
    timerEndsAtRef.current = null;
    setState(initialOnlineState(init));

    const socket = getSocket();

    const applyScores = (serverP1: number, serverP2: number) => {
      const cur = initRef.current;
      if (!cur) return buildMatchFromServerScores(init, serverP1, serverP2);
      return buildMatchFromServerScores(cur, serverP1, serverP2);
    };

    const onQuestionStart = (payload: {
      questionIndex: number;
      totalQuestions: number;
      question: {
        id: string;
        text: string;
        options: string[];
        timeLimit: number;
        imageUrl?: string | null;
      };
      timerEndsAt: number;
    }) => {
      const cur = initRef.current;
      if (!cur) return;

      const q = serverQuestionToClient(payload.question);
      timerEndsAtRef.current = payload.timerEndsAt;
      const sec = Math.max(0, Math.ceil((payload.timerEndsAt - Date.now()) / 1000));

      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentQuestion: q,
          currentQuestionIndex: payload.questionIndex,
          timeRemaining: sec,
          playerAnswer: null,
          opponentAnswer: null,
          roundResult: null,
          phase: "question",
        };
      });
    };

    const onRoundEnd = (payload: {
      correctIndex: number;
      player1Score: number;
      player2Score: number;
      roundAnswers: Record<
        string,
        { selectedIndex: number | null; isCorrect: boolean; points: number } | null
      >;
    }) => {
      timerEndsAtRef.current = null;
      const cur = initRef.current;
      if (!cur) return;

      const myAns = payload.roundAnswers[cur.myUserId];
      const oppAns = payload.roundAnswers[cur.opponentUserId];

      setState((prev) => {
        if (!prev || !prev.currentQuestion) return prev;
        const withCorrect: Question = {
          ...prev.currentQuestion,
          correctIndex: payload.correctIndex,
        };
        const myPick = myAns?.selectedIndex ?? null;
        let roundResult: BattleState["roundResult"] = "waiting";
        if (myPick === null) roundResult = "timeout";
        else if (myPick === payload.correctIndex) roundResult = "correct";
        else roundResult = "incorrect";

        return {
          ...prev,
          match: applyScores(payload.player1Score, payload.player2Score),
          currentQuestion: withCorrect,
          playerAnswer: myPick === null ? -1 : myPick,
          opponentAnswer: oppAns?.selectedIndex ?? null,
          roundResult,
          phase: "answer_reveal",
        };
      });
    };

    const onMatchEnd = (payload: {
      winnerId: string | null;
      player1: { userId: string; score: number };
      player2: { userId: string; score: number };
    }) => {
      timerEndsAtRef.current = null;
      winnerIdRef.current = payload.winnerId;
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          match: applyScores(payload.player1.score, payload.player2.score),
          phase: "match_end",
        };
      });
    };

    const onBattleError = (payload: { message?: string }) => {
      console.error("[Battle]", payload.message);
    };

    socket.emit("join_match_room", { matchId: init.matchId });

    socket.on("question_start", onQuestionStart);
    socket.on("round_end", onRoundEnd);
    socket.on("match_end", onMatchEnd);
    socket.on("battle_error", onBattleError);

    return () => {
      socket.off("question_start", onQuestionStart);
      socket.off("round_end", onRoundEnd);
      socket.off("match_end", onMatchEnd);
      socket.off("battle_error", onBattleError);
      timerEndsAtRef.current = null;
    };
  }, [init?.matchId, init?.myUserId, init?.opponentUserId]);

  useEffect(() => {
    if (!state || state.phase !== "question") return;
    const ends = timerEndsAtRef.current;
    if (!ends) return;

    const tick = () => {
      const sec = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      setState((prev) => {
        if (!prev || prev.phase !== "question") return prev;
        return { ...prev, timeRemaining: sec };
      });
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state?.phase, state?.currentQuestionIndex]);

  const submitAnswer = useCallback((selectedIndex: number) => {
    const cur = initRef.current;
    if (!cur) return;

    setState((prev) => {
      if (!prev || prev.phase !== "question" || prev.playerAnswer !== null) return prev;
      return { ...prev, playerAnswer: selectedIndex };
    });

    getSocket().emit("submit_answer", {
      matchId: cur.matchId,
      selectedIndex,
    });
  }, []);

  const proceedToNext = useCallback(() => {}, []);

  const getWinner = useCallback(() => {
    const cur = initRef.current;
    const wid = winnerIdRef.current;
    if (!cur || !wid) return "draw" as const;
    if (wid === cur.myUserId) return "player" as const;
    if (wid === cur.opponentUserId) return "opponent" as const;
    return "draw" as const;
  }, []);

  const startNextRound = useCallback(() => {}, []);

  return { state, startNextRound, submitAnswer, proceedToNext, getWinner };
}
