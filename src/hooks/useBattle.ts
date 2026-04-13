import { useState, useEffect, useCallback, useRef } from "react";
import { BattleState, Match } from "@/types";
import { battleService } from "@/services/battleService";
import { matchService } from "@/services/matchService";

export const useBattle = (match: Match | null) => {
  const [state, setState] = useState<BattleState | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opponentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (match) {
      setState(battleService.createInitialState(match));
    } else {
      setState(null);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    };
  }, [match]);

  const startNextRound = useCallback(() => {
    setState((prev) => {
      if (!prev) return null;
      const next = battleService.getNextQuestion(prev);
      return next;
    });
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!state || state.phase !== "question") return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev || prev.phase !== "question") return prev;
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return { ...battleService.handleTimeout(prev), timeRemaining: 0, phase: "answer_reveal" };
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state?.phase, state?.currentQuestionIndex]);

  // Simulate opponent answer
  useEffect(() => {
    if (!state || state.phase !== "question" || !state.currentQuestion) return;

    const opponentResult = matchService.simulateOpponentAnswer(state.currentQuestion);

    opponentTimerRef.current = setTimeout(() => {
      setState((prev) => {
        if (!prev) return null;
        return battleService.applyOpponentAnswer(prev, opponentResult.selectedIndex);
      });
    }, opponentResult.timeMs);

    return () => {
      if (opponentTimerRef.current) clearTimeout(opponentTimerRef.current);
    };
  }, [state?.currentQuestionIndex, state?.phase]);

  const submitAnswer = useCallback((selectedIndex: number) => {
    setState((prev) => {
      if (!prev) return null;
      if (timerRef.current) clearInterval(timerRef.current);
      const updated = battleService.submitAnswer(prev, selectedIndex);
      // Move to answer reveal after short delay
      setTimeout(() => {
        setState((s) => s ? { ...s, phase: "answer_reveal" } : null);
      }, 500);
      return updated;
    });
  }, []);

  const proceedToNext = useCallback(() => {
    setState((prev) => {
      if (!prev) return null;
      const next = battleService.getNextQuestion(prev);
      return next;
    });
  }, []);

  const getWinner = useCallback(() => {
    if (!state) return "draw" as const;
    return battleService.getWinner(state);
  }, [state]);

  return { state, startNextRound, submitAnswer, proceedToNext, getWinner };
};
