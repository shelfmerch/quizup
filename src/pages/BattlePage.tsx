import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBattle } from "@/hooks/useBattle";
import { useOnlineBattle, type OnlineBattleInit } from "@/hooks/useOnlineBattle";
import { Match, MatchPlayer } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { resolveQuestionImageUrl } from "@/lib/mediaUrl";
import { playCountdownSfx, playDefeatSfx, playVictorySfx, startMatchMusic, stopCountdownSfx, stopMatchMusic, stopVictorySfx, stopDefeatSfx } from "@/lib/battleAudio";
import { getSocket } from "@/services/socketService";
import { MOCK_ACHIEVEMENTS } from "@/data/mock-data";
import Icons8Icon from "@/components/Icons8Icon";

function parseBattleNav(state: unknown): { online: OnlineBattleInit | null; localMatch: Match | null } {
  if (
    state &&
    typeof state === "object" &&
    "mode" in state &&
    (state as { mode: string }).mode === "online"
  ) {
    const s = state as {
      mode: "online";
      matchId: string;
      mySeat: "player1" | "player2";
      myUserId: string;
      opponentUserId: string;
      categoryId: string;
      categoryName: string;
      totalRounds: number;
      me: MatchPlayer;
      opponent: MatchPlayer;
    };
    return {
      online: {
        matchId: s.matchId,
        mySeat: s.mySeat,
        myUserId: s.myUserId,
        opponentUserId: s.opponentUserId,
        me: s.me,
        opponent: s.opponent,
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        totalRounds: s.totalRounds,
      },
      localMatch: null,
    };
  }
  const m = (state as { match?: Match } | null)?.match;
  return { online: null, localMatch: m ?? null };
}

/** Subtitle under display name (screenshot-style; we only have level in match state). */
function playerTagline(p: MatchPlayer): string {
  if (p.level <= 2) return "Beginner";
  if (p.level <= 5) return "Rising star";
  if (p.level <= 10) return "Challenger";
  if (p.level <= 20) return "Veteran";
  return `Level ${p.level}`;
}

/** Full-width horizontal bar — depletes as time runs out; color shifts for urgency. */
function TimerProgressBar({
  percentRemaining,
  secondsLeft,
  revealed,
}: {
  percentRemaining: number;
  secondsLeft: number;
  revealed: boolean;
}) {
  const p = revealed ? 100 : Math.max(0, Math.min(100, percentRemaining));
  const urgent = !revealed && secondsLeft <= 3;
  const barColor = revealed
    ? "bg-zinc-600"
    : p > 45
      ? "bg-emerald-500"
      : p > 20
        ? "bg-amber-400"
        : urgent
          ? "bg-red-500"
          : "bg-amber-500";

  return (
    <motion.div
      className={`mx-3 mb-2 h-3 rounded-full bg-zinc-800/90 overflow-hidden border border-zinc-700/80 ${
        urgent ? "ring-2 ring-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.35)]" : ""
      }`}
      animate={urgent ? { opacity: [1, 0.88, 1] } : { opacity: 1 }}
      transition={urgent ? { repeat: Infinity, duration: 0.45 } : {}}
      role="progressbar"
      aria-valuenow={revealed ? 100 : Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={revealed ? "Round finished" : `Time remaining about ${secondsLeft} seconds`}
    >
      <motion.div
        className={`h-full rounded-full ${barColor} shadow-sm`}
        initial={false}
        animate={{ width: `${p}%` }}
        transition={{ duration: 0.2, ease: "linear" }}
      />
    </motion.div>
  );
}

function VerticalTimerBar({
  percent,
  variant,
  urgent,
}: {
  percent: number;
  variant: "you" | "opponent";
  urgent: boolean;
}) {
  const fill =
    variant === "you"
      ? urgent
        ? "bg-red-500"
        : "bg-emerald-500"
      : urgent
        ? "bg-red-500"
        : "bg-red-600";
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="w-2 shrink-0 rounded-full bg-zinc-800 overflow-hidden flex flex-col justify-end self-stretch my-1 h-full min-h-[240px]"
      aria-hidden
    >
      <motion.div
        className={`w-full ${fill} rounded-full`}
        initial={false}
        animate={{ height: `${p}%` }}
        transition={{ duration: 0.25, ease: "linear" }}
      />
    </div>
  );
}

const BattlePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { online: onlineInit, localMatch } = useMemo(() => parseBattleNav(location.state), [location.state]);

  const onlineBattle = useOnlineBattle(onlineInit);
  const localBattle = useBattle(onlineInit ? null : localMatch);

  const isOnline = !!onlineInit;
  const { state, startNextRound, submitAnswer, proceedToNext, getWinner } = isOnline ? onlineBattle : localBattle;

  const endSfxPlayedRef = useRef(false);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchMusicStartedRef = useRef(false);

  const [unlockedAchievements, setUnlockedAchievements] = useState<{ id: string; name: string; icon: string }[]>([]);

  useEffect(() => {
    if (!isOnline) return;
    try {
      const socket = getSocket();
      const onNotif = (notif: any) => {
        if (notif.type === "achievement") {
          const mockMatch = MOCK_ACHIEVEMENTS.find(a => a.id === notif.achievementId);
          if (mockMatch) {
            setUnlockedAchievements(prev => {
              if (prev.some(a => a.id === notif.achievementId)) return prev;
              return [...prev, { id: mockMatch.id, name: mockMatch.name, icon: mockMatch.icon }];
            });
          }
        }
      };
      socket.on("notification", onNotif);
      return () => {
        socket.off("notification", onNotif);
      };
    } catch {
      // ignore
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) return;
    if (!localMatch) {
      navigate("/home");
      return;
    }
    const t = setTimeout(() => startNextRound(), 1500);
    return () => clearTimeout(t);
  }, [isOnline, localMatch, navigate, startNextRound]);

  const match = state?.match;

  if (!state || !match) return null;

  // ─── Battle audio: start once per match; stop at end; victory/defeat once ──
  useEffect(() => {
    if (!state) return;
    if (state.phase === "match_end") return;
    if (matchMusicStartedRef.current) return;
    matchMusicStartedRef.current = true;
    startMatchMusic();
  }, [state?.phase]);

  useEffect(() => {
    if (!state) return;

    if (state.phase === "match_end") {
      stopMatchMusic();
      if (!endSfxPlayedRef.current) {
        const winner = getWinner();
        if (winner === "player") playVictorySfx();
        else if (winner === "opponent") playDefeatSfx();
        endSfxPlayedRef.current = true;
      }
      return;
    }

    endSfxPlayedRef.current = false;
  }, [state?.phase, getWinner]);

  // Stop music if user navigates away mid-match.
  useEffect(() => {
    return () => {
      matchMusicStartedRef.current = false;
      stopMatchMusic();
      stopVictorySfx();
      stopDefeatSfx();
    };
  }, []);

  // ─── Countdown SFX: play 6s after each question appears ────────────────────
  useEffect(() => {
    if (!state || state.phase !== "question") {
      if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
      stopCountdownSfx();
      return;
    }

    // New question (or re-render) — schedule fresh and stop any previous audio.
    stopCountdownSfx();
    if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
    countdownTimeoutRef.current = setTimeout(() => {
      // Only play if we are still on a live question.
      playCountdownSfx();
    }, 5000);

    return () => {
      if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
      stopCountdownSfx();
    };
  }, [state?.phase, state?.currentQuestion?.id]);

  const showManualNext = !isOnline;

  if (state.phase === "match_end") {
    const winner = getWinner();
    return (
      <div className="h-[100dvh] overflow-hidden bg-quizup-dark text-white flex flex-col max-w-md mx-auto">
        <div className="pt-8 pb-4 flex flex-col items-center flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-quizup-gold/10 to-transparent pointer-events-none" />
          <Icons8Icon
            name={winner === "player" ? "trophy" : winner === "opponent" ? "crying" : "handshake"}
            size={96}
            style="animated-fluency"
          />
          <h1
            className={`text-3xl font-display font-extrabold tracking-tight mt-4 ${
              winner === "player" ? "text-quizup-gold" : winner === "opponent" ? "text-quizup-red" : "text-zinc-300"
            }`}
          >
            {winner === "player" ? "Victory!" : winner === "opponent" ? "Defeat" : "Draw!"}
          </h1>
        </div>

        <div className="flex px-4 gap-4 pb-6 relative z-10 flex-shrink-0">
          <div className="flex-1 rounded-2xl bg-quizup-card border-2 border-border p-4 text-center shadow-lg relative overflow-hidden">
            {winner === "player" && <div className="absolute inset-0 bg-emerald-500/10" />}
            <img src={state.match.player1.avatarUrl} alt="" className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-emerald-500/50" />
            <p className="text-sm font-semibold truncate text-white relative z-10">{state.match.player1.username}</p>
            <p className="text-3xl font-display font-extrabold text-emerald-400 mt-2 relative z-10">{state.match.player1.score}</p>
          </div>
          <div className="flex-1 rounded-2xl bg-quizup-card border-2 border-border p-4 text-center shadow-lg relative overflow-hidden">
            {winner === "opponent" && <div className="absolute inset-0 bg-red-500/10" />}
            <img src={state.match.player2.avatarUrl} alt="" className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-red-500/50" />
            <p className="text-sm font-semibold truncate text-white relative z-10">{state.match.player2.username}</p>
            <p className="text-3xl font-display font-extrabold text-red-500 mt-2 relative z-10">{state.match.player2.score}</p>
          </div>
        </div>

        {unlockedAchievements.length > 0 && (
          <div className="px-4 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-shrink-0 relative z-10">
            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center mb-3">
              Achievements Unlocked
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {unlockedAchievements.map(ach => (
                <div key={ach.id} className="bg-quizup-surface/80 rounded-xl px-4 py-2 border border-quizup-gold/30 flex items-center gap-3 shadow-md">
                  <span className="text-2xl">{ach.icon}</span>
                  <span className="font-semibold text-sm text-quizup-gold">{ach.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-8 flex flex-col justify-end gap-3 min-h-[160px] relative z-10">
          <button
            type="button"
            onClick={() => {
              stopVictorySfx();
              stopDefeatSfx();
              navigate(`/find-match/${match.categoryId}`);
            }}
            className="w-full h-14 rounded-xl bg-quizup-header-purple text-white font-semibold text-base active:scale-[0.98] transition-all hover:brightness-110 shadow-lg"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={() => {
              stopVictorySfx();
              stopDefeatSfx();
              navigate("/home");
            }}
            className="w-full h-14 rounded-xl bg-quizup-surface text-white font-semibold text-base border border-border transition-all hover:bg-zinc-800"
          >
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  // Intro
  if (state.phase === "intro") {
    return (
      <div className="h-[100dvh] overflow-hidden bg-black text-white flex flex-col items-center justify-center max-w-md mx-auto px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full">
          <div className="flex justify-between items-start gap-4 mb-10">
            <div className="flex-1 flex gap-3 items-start text-left">
              <img
                src={state.match.player1.avatarUrl}
                alt=""
                className="w-14 h-14 rounded-full shrink-0 border border-zinc-700"
              />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{state.match.player1.username}</p>
                <p className="text-xs text-zinc-500">{playerTagline(state.match.player1)}</p>
              </div>
            </div>
            <div className="flex-1 flex gap-3 items-start flex-row-reverse text-right">
              <img
                src={state.match.player2.avatarUrl}
                alt=""
                className="w-14 h-14 rounded-full shrink-0 border border-zinc-700"
              />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{state.match.player2.username}</p>
                <p className="text-xs text-zinc-500">{playerTagline(state.match.player2)}</p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">Get ready!</p>
          <p className="text-zinc-500 text-sm mt-2">
            {state.match.categoryName} · {state.match.totalRounds} questions
          </p>
        </motion.div>
      </div>
    );
  }

  const question = state.currentQuestion;
  if (!question) return null;

  const isRevealed = state.phase === "answer_reveal";
  const timerPercent = (state.timeRemaining / question.timeLimit) * 100;
  const questionImageSrc = resolveQuestionImageUrl(question.imageUrl);
  const urgent = state.timeRemaining <= 3 && !isRevealed;

  const p1 = state.match.player1;
  const p2 = state.match.player2;

  return (
    <div className="h-[100dvh] overflow-hidden bg-black text-white flex flex-col max-w-md mx-auto font-sans">
      {/* 1v1 header — names, taglines, colored scores */}
      <header className="flex px-3 pt-4 pb-3 gap-2 border-b border-zinc-900">
        <div className="flex-1 flex gap-2.5 items-start min-w-0">
          <img src={p1.avatarUrl} alt="" className="w-12 h-12 rounded-full shrink-0 border border-zinc-700 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] leading-tight truncate text-white">{p1.username}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{playerTagline(p1)}</p>
            <p className="text-[28px] font-bold text-emerald-500 leading-none mt-1.5 tabular-nums">{p1.score}</p>
          </div>
        </div>
        <div className="flex-1 flex gap-2.5 items-start flex-row-reverse min-w-0 text-right">
          <img src={p2.avatarUrl} alt="" className="w-12 h-12 rounded-full shrink-0 border border-zinc-700 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] leading-tight truncate text-white">{p2.username}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{playerTagline(p2)}</p>
            <p className="text-[28px] font-bold text-red-500 leading-none mt-1.5 tabular-nums">{p2.score}</p>
          </div>
        </div>
      </header>

      <TimerProgressBar
        percentRemaining={timerPercent}
        secondsLeft={state.timeRemaining}
        revealed={isRevealed}
      />

      {/* Side bars + main column */}
      <div className="flex-1 flex flex-row items-stretch min-h-0 px-1 gap-1 pb-4 pt-0">
        <VerticalTimerBar percent={timerPercent} variant="you" urgent={urgent} />

        <div className="flex-1 flex flex-col min-w-0 px-2 overflow-y-auto">
          <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest mb-3">
            Question {state.currentQuestionIndex + 1} of {state.match.totalRounds}
            {!isRevealed && (
              <span className="text-zinc-600 normal-case tracking-normal">
                {" "}
                · <span className="tabular-nums">{state.timeRemaining}</span>s
              </span>
            )}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col flex-1"
            >
              {/* Question text first, then image (screenshot order) */}
              <p className="text-center text-[17px] font-medium leading-snug text-white px-1 mb-4">{question.text}</p>

              {questionImageSrc ? (
                <div className="w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 mb-4">
                  <img src={questionImageSrc} alt="" className="w-full max-h-52 object-contain mx-auto" />
                </div>
              ) : null}

              {/* Light tiles, dark text */}
              <div className="grid grid-cols-2 gap-2.5 mt-auto pb-2">
                {question.options.map((option, idx) => {
                  const isSelected = state.playerAnswer === idx;
                  const isCorrect = idx === question.correctIndex;
                  const showResult = isRevealed;

                  let tile =
                    "bg-zinc-200 text-zinc-900 hover:bg-white active:scale-[0.98] border border-zinc-300/80";
                  if (showResult && isCorrect) {
                    tile = "bg-emerald-200 text-emerald-950 border-2 border-emerald-500";
                  } else if (showResult && isSelected && !isCorrect) {
                    tile = "bg-red-200 text-red-950 border-2 border-red-500";
                  } else if (showResult && !isCorrect) {
                    tile = "bg-zinc-700/50 text-zinc-400 border border-zinc-600";
                  } else if (isSelected && !showResult) {
                    tile = "bg-white text-black ring-2 ring-emerald-500 ring-offset-2 ring-offset-black border border-zinc-300";
                  }

                  return (
                    <motion.button
                      key={idx}
                      type="button"
                      whileTap={!isRevealed && state.playerAnswer === null ? { scale: 0.97 } : {}}
                      onClick={() => !isRevealed && state.playerAnswer === null && submitAnswer(idx)}
                      disabled={isRevealed || state.playerAnswer !== null}
                      className={`rounded-xl min-h-[56px] px-3 flex items-center justify-center text-center transition-colors ${tile} disabled:opacity-90`}
                    >
                      <span className="text-sm font-semibold leading-tight">{option}</span>
                    </motion.button>
                  );
                })}
              </div>

              {isRevealed && showManualNext && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={proceedToNext}
                  className="w-full h-12 rounded-xl bg-zinc-100 text-black font-semibold text-sm mt-3"
                >
                  {state.currentQuestionIndex + 1 >= state.match.totalRounds ? "See results" : "Next question"}
                </motion.button>
              )}
              {isRevealed && !showManualNext && (
                <p className="text-center text-zinc-500 text-sm mt-3">Next round starting…</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <VerticalTimerBar percent={timerPercent} variant="opponent" urgent={urgent} />
      </div>
    </div>
  );
};

export default BattlePage;
