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
import { useAuth } from "@/hooks/useAuth";

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
      className={`mx-3 mb-2 h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 ${
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
      className="w-2 shrink-0 rounded-full bg-slate-100 overflow-hidden flex flex-col justify-end self-stretch my-1 h-full min-h-[240px]"
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

type LeagueKey =
  | "unranked"
  | "bronze"
  | "silver"
  | "gold"
  | "crystal"
  | "master"
  | "champion"
  | "titan"
  | "legend";

const LEAGUES: Array<{
  key: LeagueKey;
  name: string;
  minXpInclusive: number;
  badgeUrl: string;
}> = [
  { key: "legend", name: "Legend", minXpInclusive: 20000, badgeUrl: "/leagues/legend.svg" },
  { key: "titan", name: "Titan", minXpInclusive: 15000, badgeUrl: "/leagues/titan.png" },
  { key: "champion", name: "Champion", minXpInclusive: 13000, badgeUrl: "/leagues/champion.png" },
  { key: "master", name: "Master", minXpInclusive: 10000, badgeUrl: "/leagues/master.png" },
  { key: "crystal", name: "Crystal", minXpInclusive: 7000, badgeUrl: "/leagues/crystal.png" },
  { key: "gold", name: "Gold", minXpInclusive: 5000, badgeUrl: "/leagues/gold.png" },
  { key: "silver", name: "Silver", minXpInclusive: 2000, badgeUrl: "/leagues/silver.png" },
  { key: "bronze", name: "Bronze", minXpInclusive: 1000, badgeUrl: "/leagues/bronze.png" },
  { key: "unranked", name: "Unranked", minXpInclusive: 0, badgeUrl: "/leagues/unranked.png" },
];

function getLeagueFromXp(xpRaw: unknown) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? xpRaw : 0;
  for (const league of LEAGUES) {
    if (xp >= league.minXpInclusive) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

const BattlePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { online: onlineInit, localMatch } = useMemo(() => parseBattleNav(location.state), [location.state]);
  const { user, refreshUser } = useAuth();

  const onlineBattle = useOnlineBattle(onlineInit);
  const localBattle = useBattle(onlineInit ? null : localMatch);

  const isOnline = !!onlineInit;
  const { state, startNextRound, submitAnswer, proceedToNext, getWinner } = isOnline ? onlineBattle : localBattle;

  const endSfxPlayedRef = useRef(false);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchMusicStartedRef = useRef(false);

  const [unlockedAchievements, setUnlockedAchievements] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [showDedicatedAchievements, setShowDedicatedAchievements] = useState(false);
  const achievementsScreenShownRef = useRef(false);

  const xpBeforeMatchRef = useRef<number | null>(null);
  const [leaguePromotion, setLeaguePromotion] = useState<{
    from: ReturnType<typeof getLeagueFromXp>;
    to: ReturnType<typeof getLeagueFromXp>;
  } | null>(null);

  useEffect(() => {
    if (xpBeforeMatchRef.current !== null) return;
    const xp = typeof user?.xp === "number" && Number.isFinite(user.xp) ? user.xp : null;
    xpBeforeMatchRef.current = xp;
  }, [user?.xp]);

  useEffect(() => {
    if (state?.phase !== "match_end") return;
    if (!user?.id) return;
    const beforeXp = xpBeforeMatchRef.current;
    if (beforeXp === null) return;

    let cancelled = false;
    (async () => {
      try {
        await refreshUser();
        if (cancelled) return;
        const afterXp = typeof user?.xp === "number" && Number.isFinite(user.xp) ? user.xp : null;
        if (afterXp === null) return;

        const from = getLeagueFromXp(beforeXp);
        const to = getLeagueFromXp(afterXp);
        if (from.key !== to.key) {
          setLeaguePromotion({ from, to });
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, state?.phase, user?.id, user?.xp]);

  useEffect(() => {
    if (state?.phase === "match_end" && unlockedAchievements.length > 0 && !achievementsScreenShownRef.current) {
      achievementsScreenShownRef.current = true;
      setShowDedicatedAchievements(true);
      const t = setTimeout(() => setShowDedicatedAchievements(false), 5000);
      return () => clearTimeout(t);
    }
  }, [state?.phase, unlockedAchievements.length]);

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

    if (showDedicatedAchievements) {
      return (
        <div className="h-[100dvh] overflow-hidden flex flex-col items-center justify-center max-w-md mx-auto relative animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-100/50 to-transparent pointer-events-none" />
          <Icons8Icon name="trophy" fallback="🏆" size={120} style="animated-fluency" />
          <h1 className="text-4xl font-display font-black tracking-tight mt-6 text-slate-900 mb-2 text-center drop-shadow-sm">
            Epic Unlocks!
          </h1>
          <div className="flex flex-col gap-4 mt-8 w-full px-8 relative z-10">
            {leaguePromotion && (
              <div className="glass-card rounded-3xl p-5 border-emerald-200 flex items-center gap-4 shadow-xl shadow-emerald-500/10 animate-in slide-in-from-bottom-8 duration-700">
                <img src={leaguePromotion.to.badgeUrl} alt="" className="w-14 h-14 object-contain shrink-0 drop-shadow-md" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">League promoted</p>
                  <p className="font-extrabold text-xl text-slate-900 truncate">
                    {leaguePromotion.to.name}
                  </p>
                </div>
              </div>
            )}
            {unlockedAchievements.map(ach => (
              <div key={ach.id} className="glass-card rounded-3xl p-5 border-amber-200 flex items-center gap-4 shadow-xl shadow-amber-500/10 animate-in slide-in-from-bottom-8 duration-700">
                <span className="text-4xl drop-shadow-sm">{ach.icon}</span>
                <span className="font-bold text-lg text-slate-900">{ach.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col max-w-md mx-auto">
        <div className="pt-10 pb-6 flex flex-col items-center flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent pointer-events-none" />
          <Icons8Icon
            name={winner === "player" ? "trophy" : winner === "opponent" ? "crying" : "handshake"}
            fallback={winner === "player" ? "🏆" : winner === "opponent" ? "😢" : "🤝"}
            size={110}
            style="animated-fluency"
          />
          <h1
            className={`text-4xl font-display font-black tracking-tight mt-6 ${
              winner === "player" ? "text-emerald-600" : winner === "opponent" ? "text-red-600" : "text-slate-600"
            }`}
          >
            {winner === "player" ? "You Won!" : winner === "opponent" ? "Defeat" : "Draw!"}
          </h1>
        </div>

        <div className="flex px-4 gap-4 pb-8 relative z-10 flex-shrink-0">
          <div className="flex-1 rounded-3xl glass-card p-5 text-center relative overflow-hidden">
            {winner === "player" && <div className="absolute inset-0 bg-emerald-500/5" />}
            <div className="relative inline-block">
              <img src={state.match.player1.avatarUrl} alt="" className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white shadow-lg" />
              {winner === "player" && <span className="absolute -top-1 -right-1 text-2xl">👑</span>}
            </div>
            <p className="text-sm font-black truncate text-slate-900 relative z-10">{state.match.player1.username}</p>
            <p className="text-4xl font-display font-black text-emerald-500 mt-2 relative z-10 drop-shadow-sm">{state.match.player1.score}</p>
          </div>
          <div className="flex-1 rounded-3xl glass-card p-5 text-center relative overflow-hidden">
            {winner === "opponent" && <div className="absolute inset-0 bg-red-500/5" />}
            <div className="relative inline-block">
              <img src={state.match.player2.avatarUrl} alt="" className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-white shadow-lg" />
              {winner === "opponent" && <span className="absolute -top-1 -right-1 text-2xl">👑</span>}
            </div>
            <p className="text-sm font-black truncate text-slate-900 relative z-10">{state.match.player2.username}</p>
            <p className="text-4xl font-display font-black text-red-500 mt-2 relative z-10 drop-shadow-sm">{state.match.player2.score}</p>
          </div>
        </div>

        {unlockedAchievements.length > 0 && (
          <div className="px-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-shrink-0 relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-4">
              Achievements Unlocked
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {unlockedAchievements.map(ach => (
                <div key={ach.id} className="bg-white/90 rounded-[1.2rem] px-5 py-2.5 border border-white flex items-center gap-3 shadow-md">
                  <span className="text-2xl drop-shadow-sm">{ach.icon}</span>
                  <span className="font-bold text-sm text-slate-800">{ach.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 px-6 pb-10 flex flex-col justify-end gap-4 relative z-10">
          <button
            type="button"
            onClick={() => {
              stopVictorySfx();
              stopDefeatSfx();
              navigate(`/find-match/${match.categoryId}`);
            }}
            className="w-full h-16 rounded-2xl btn-gradient-purple text-white font-black text-lg shadow-xl shadow-purple-500/20"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={() => {
              stopVictorySfx();
              stopDefeatSfx();
              navigate("/home");
            }}
            className="w-full h-16 rounded-2xl bg-white/80 backdrop-blur-md text-slate-700 font-bold text-lg border border-slate-200 shadow-sm"
          >
            Lobby
          </button>
        </div>
      </div>
    );
  }

  // Intro
  if (state.phase === "intro") {
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col items-center justify-center max-w-md mx-auto px-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full glass-card p-10 rounded-[3rem]">
          <div className="flex justify-between items-center gap-4 mb-12">
            <div className="flex-1 flex flex-col items-center gap-3">
              <img
                src={state.match.player1.avatarUrl}
                alt=""
                className="w-20 h-20 rounded-full shadow-xl border-4 border-white"
              />
              <div className="min-w-0">
                <p className="font-black text-sm text-slate-900 truncate">{state.match.player1.username}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{playerTagline(state.match.player1)}</p>
              </div>
            </div>
            
            <div className="px-4">
              <span className="text-2xl font-display font-black text-slate-300">VS</span>
            </div>

            <div className="flex-1 flex flex-col items-center gap-3">
              <img
                src={state.match.player2.avatarUrl}
                alt=""
                className="w-20 h-20 rounded-full shadow-xl border-4 border-white"
              />
              <div className="min-w-0">
                <p className="font-black text-sm text-slate-900 truncate">{state.match.player2.username}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{playerTagline(state.match.player2)}</p>
              </div>
            </div>
          </div>
          <p className="text-3xl font-display font-black tracking-tight text-slate-900">Get Ready!</p>
          <p className="text-slate-500 font-bold text-sm mt-3 px-4">
             {state.match.categoryName} · {state.match.totalRounds} rounds
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
    <div className="h-[100dvh] overflow-hidden flex flex-col max-w-md mx-auto font-sans">
      {/* 1v1 header — names, taglines, colored scores */}
      <header className="flex px-4 pt-4 pb-3 gap-3 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="flex-1 flex gap-3 items-start min-w-0">
          <img src={p1.avatarUrl} alt="" className="w-14 h-14 rounded-full shrink-0 border-2 border-white shadow-md object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-black text-[15px] leading-tight truncate text-slate-900">{p1.username}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{playerTagline(p1)}</p>
            <p className="text-3xl font-display font-black text-emerald-500 leading-none mt-2 tabular-nums drop-shadow-sm">{p1.score}</p>
          </div>
        </div>
        <div className="flex-1 flex gap-3 items-start flex-row-reverse min-w-0 text-right">
          <img src={p2.avatarUrl} alt="" className="w-14 h-14 rounded-full shrink-0 border-2 border-white shadow-md object-cover" />
          <div className="min-w-0 flex-1">
            <p className="font-black text-[15px] leading-tight truncate text-slate-900">{p2.username}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{playerTagline(p2)}</p>
            <p className="text-3xl font-display font-black text-red-500 leading-none mt-2 tabular-nums drop-shadow-sm">{p2.score}</p>
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
          <p className="text-[10px] text-slate-400 text-center uppercase tracking-[0.2em] mb-4 mt-2 font-black">
            Round {state.currentQuestionIndex + 1} / {state.match.totalRounds}
            {!isRevealed && (
              <span className="text-slate-300 normal-case tracking-normal font-bold">
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
              <p className="text-center text-xl font-bold leading-snug text-slate-900 px-2 mb-6 tracking-tight">{question.text}</p>

              {questionImageSrc ? (
                <div className="w-full rounded-[2.5rem] overflow-hidden bg-white shadow-xl border border-slate-100 mb-8 p-2">
                  <img src={questionImageSrc} alt="" className="w-full max-h-60 rounded-[2rem] object-cover mx-auto" />
                </div>
              ) : null}

              {/* Light tiles, dark text */}
              <div className="grid grid-cols-2 gap-2.5 mt-auto pb-2">
                {question.options.map((option, idx) => {
                  const isSelected = state.playerAnswer === idx;
                  const isCorrect = idx === question.correctIndex;
                  const showResult = isRevealed;

                  let tile =
                    "bg-white text-slate-800 border-2 border-slate-100 shadow-md hover:border-slate-300 active:scale-[0.98] active:bg-slate-50";
                  if (showResult && isCorrect) {
                    tile = "bg-emerald-500 text-white border-none shadow-lg shadow-emerald-500/20";
                  } else if (showResult && isSelected && !isCorrect) {
                    tile = "bg-red-500 text-white border-none shadow-lg shadow-red-500/20";
                  } else if (showResult && !isCorrect) {
                    tile = "bg-slate-50 text-slate-300 border-slate-100 opacity-60";
                  } else if (isSelected && !showResult) {
                    tile = "bg-purple-600 text-white border-none ring-4 ring-purple-100 shadow-lg shadow-purple-500/20";
                  }

                  return (
                    <motion.button
                      key={idx}
                      type="button"
                      whileTap={!isRevealed && state.playerAnswer === null ? { scale: 0.95 } : {}}
                      onClick={() => !isRevealed && state.playerAnswer === null && submitAnswer(idx)}
                      disabled={isRevealed || state.playerAnswer !== null}
                      className={`rounded-2xl min-h-[64px] px-4 flex items-center justify-center text-center transition-all duration-300 ${tile} disabled:opacity-100`}
                    >
                      <span className="text-[15px] font-black leading-tight tracking-tight">{option}</span>
                    </motion.button>
                  );
                })}
              </div>

              {isRevealed && showManualNext && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={proceedToNext}
                  className="w-full h-14 rounded-2xl btn-gradient-purple text-white font-black text-sm mt-6 shadow-xl"
                >
                  {state.currentQuestionIndex + 1 >= state.match.totalRounds ? "FINISH MATCH" : "NEXT ROUND"}
                </motion.button>
              )}
              {isRevealed && !showManualNext && (
                <p className="text-center text-slate-400 font-bold text-xs mt-6 tracking-widest uppercase animate-pulse">Waiting for opponent…</p>
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
