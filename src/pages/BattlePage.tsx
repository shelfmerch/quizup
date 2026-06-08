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
import { authService } from "@/services/authService";
import {
  getLeagueFromXp,
  levelProgressPercent,
  xpRemainingToNextLevel,
} from "@/lib/progression";

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
function categoryDetailPath(categoryId: string | undefined): string {
  return categoryId ? `/category/${categoryId}` : "/";
}

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

function CircleProgress({
  level,
  xpGained,
  xpToNext,
  progressPercent,
}: {
  level: number;
  xpGained: number;
  xpToNext: number;
  progressPercent: number;
}) {
  const radius = 70;
  const stroke = 20;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = Math.min(100, Math.max(0, progressPercent));
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex justify-center items-center mt-8 mb-6 max-w-[320px] mx-auto w-full">
      {/* XP TO LEVEL - Top Left */}
      <div className="absolute top-[-16px] left-[-10px] flex items-end">
         <div className="text-right mr-1.5">
            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">XP TO LEVEL {level + 1}</div>
            <div className="text-xl font-bold text-white leading-none mt-1">{xpToNext}</div>
         </div>
         <div className="w-8 h-px bg-slate-400 mb-2"></div>
      </div>

      {/* XP GAINED - Bottom Right */}
      <div className="absolute bottom-[-16px] right-[-10px] flex items-start">
         <div className="w-8 h-px bg-slate-400 mt-2"></div>
         <div className="text-left ml-1.5">
            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">XP GAINED</div>
            <div className="text-xl font-bold text-white leading-none mt-1">{xpGained}</div>
         </div>
      </div>

      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke="#b392ff"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#ffffff"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="butt"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center bg-[#2a2a2a] rounded-full" style={{ width: radius * 2 - stroke * 2 - 2, height: radius * 2 - stroke * 2 - 2 }}>
        <span className="text-[10px] font-bold text-slate-300 tracking-widest mt-1">LEVEL</span>
        <span className="text-4xl font-black text-white leading-none mt-1">{level}</span>
      </div>
    </div>
  );
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
  const battlePhaseRef = useRef(state?.phase);
  battlePhaseRef.current = state?.phase;

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isLeavingMatch, setIsLeavingMatch] = useState(false);
  const leaveFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Result breakdown from the server (online only; null until match_end received)
  const { myMatchResult } = isOnline ? onlineBattle : { myMatchResult: null };

  const [unlockedAchievements, setUnlockedAchievements] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [showDedicatedAchievements, setShowDedicatedAchievements] = useState(false);
  const achievementsScreenShownRef = useRef(false);

  const progressionBeforeRef = useRef<{ xp: number; level: number } | null>(null);
  const [leaguePromotion, setLeaguePromotion] = useState<{
    from: ReturnType<typeof getLeagueFromXp>;
    to: ReturnType<typeof getLeagueFromXp>;
  } | null>(null);
  const [levelPromotion, setLevelPromotion] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (progressionBeforeRef.current !== null) return;
    if (user?.level == null || user?.xp == null) return;
    progressionBeforeRef.current = {
      xp: user.xp,
      level: user.level,
    };
  }, [user?.level, user?.xp]);

  useEffect(() => {
    if (state?.phase !== "match_end") return;
    if (!user?.id) return;
    if (progressionBeforeRef.current === null) return;

    let cancelled = false;
    (async () => {
      try {
        await refreshUser();
        if (cancelled) return;
        const fresh = authService.getCurrentUser();
        if (!fresh) return;

        const afterXp = fresh.xp ?? 0;
        const afterLevel = fresh.level ?? 1;
        const before = progressionBeforeRef.current!;

        const fromLeague = getLeagueFromXp(before.xp);
        const toLeague = getLeagueFromXp(afterXp);
        if (fromLeague.key !== toLeague.key) {
          setLeaguePromotion({ from: fromLeague, to: toLeague });
        }

        if (afterLevel > before.level) {
          setLevelPromotion({ from: before.level, to: afterLevel });
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, state?.phase, user?.id, user?.level, user?.xp]);

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
      const onNotif = (notif: { type: string; achievementId?: string }) => {
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
      navigate("/");
      return;
    }
    const t = setTimeout(() => startNextRound(), 1500);
    return () => clearTimeout(t);
  }, [isOnline, localMatch, navigate, startNextRound]);

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

  // Tab close / refresh only — do NOT emit leave_match on React unmount (HMR, remounts).
  useEffect(() => {
    if (!isOnline || !onlineInit) return;

    const emitLeaveIfActive = () => {
      if (battlePhaseRef.current === "match_end") return;
      try {
        getSocket().emit("leave_match", { matchId: onlineInit.matchId });
      } catch {
        // ignore
      }
    };

    window.addEventListener("pagehide", emitLeaveIfActive);
    return () => window.removeEventListener("pagehide", emitLeaveIfActive);
  }, [isOnline, onlineInit?.matchId]);

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

  const match = state?.match;
  const showManualNext = !isOnline;

  // Stop the fallback timer once the server confirms match_end.
  useEffect(() => {
    if (state?.phase === "match_end") {
      if (leaveFallbackRef.current) {
        clearTimeout(leaveFallbackRef.current);
        leaveFallbackRef.current = null;
      }
      setIsLeavingMatch(false);
      setShowExitConfirm(false);
    }
  }, [state?.phase]);

  useEffect(() => {
    return () => {
      if (leaveFallbackRef.current) clearTimeout(leaveFallbackRef.current);
    };
  }, []);

  const requestExitMatch = () => {
    if (!state) return;
    if (state.phase === "match_end") {
      navigate(categoryDetailPath(match?.categoryId));
      return;
    }
    setShowExitConfirm(true);
  };

  const confirmExitMatch = () => {
    if (!state || isLeavingMatch) return;

    if (state.phase === "match_end") {
      setShowExitConfirm(false);
      navigate(categoryDetailPath(match?.categoryId));
      return;
    }

    if (!isOnline) {
      setShowExitConfirm(false);
      navigate(categoryDetailPath(match?.categoryId));
      return;
    }

    if (!onlineInit) return;

    setIsLeavingMatch(true);
    try {
      getSocket().emit("leave_match", { matchId: onlineInit.matchId });
    } catch {
      // socket may be gone — fall through to navigate
    }

    // Safety: if match_end doesn't arrive (e.g. socket lost), still leave gracefully.
    leaveFallbackRef.current = setTimeout(() => {
      setIsLeavingMatch(false);
      setShowExitConfirm(false);
      navigate(categoryDetailPath(match?.categoryId));
    }, 4000);
  };

  if (!state || !match) return null;

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
            {levelPromotion && (
              <div className="glass-card rounded-3xl p-5 border-violet-200 flex items-center gap-4 shadow-xl shadow-violet-500/10 animate-in slide-in-from-bottom-8 duration-700">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg">
                  <span className="text-2xl font-black text-white">{levelPromotion.to}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-widest">Level up</p>
                  <p className="font-extrabold text-xl text-slate-900 truncate">
                    Level {levelPromotion.from} → {levelPromotion.to}
                  </p>
                </div>
              </div>
            )}
            {leaguePromotion && (
              <div
                className={`glass-card rounded-3xl p-5 flex items-center gap-4 shadow-xl animate-in slide-in-from-bottom-8 duration-700 ${
                  leaguePromotion.to.minXpInclusive > leaguePromotion.from.minXpInclusive
                    ? "border-emerald-200 shadow-emerald-500/10"
                    : "border-rose-200 shadow-rose-500/10"
                }`}
              >
                <img src={leaguePromotion.to.badgeUrl} alt="" className="w-14 h-14 object-contain shrink-0 drop-shadow-md" />
                <div className="min-w-0">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-widest ${
                      leaguePromotion.to.minXpInclusive > leaguePromotion.from.minXpInclusive
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {leaguePromotion.to.minXpInclusive > leaguePromotion.from.minXpInclusive
                      ? "League promoted"
                      : "League dropped"}
                  </p>
                  <p className="font-extrabold text-xl text-slate-900 truncate">
                    {leaguePromotion.from.name} → {leaguePromotion.to.name}
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

    // ── Result breakdown ───────────────────────────────────────────────────
    // Online: use server-computed values.  Local/offline: derive from raw score.
    const rawScore   = state.match.player1.score;
    const levelBonus = myMatchResult?.levelBonus ?? 0;
    const finalPts   = myMatchResult?.finalPoints ?? (rawScore + levelBonus);
    // Loser earns 0 XP from the match; winner/draw earn 10% of finalPoints
    const xpGained   = myMatchResult?.xpGained ?? (winner === 'opponent' ? 0 : Math.floor(finalPts * 0.10));
    const xpPenalty  = myMatchResult?.xpPenalty ?? 0;
    // Loser's netXp is always negative (0 gained − penalty); winner's is +xpGained
    const netXp      = myMatchResult?.netXp ?? (winner === 'opponent' ? -xpPenalty : xpGained);
    const displayLevel = user?.level ?? state.match.player1.level ?? 1;
    const displayXp = user?.xp ?? 0;
    const xpToNext = xpRemainingToNextLevel(displayXp, displayLevel);
    const ringProgress = levelProgressPercent(displayXp, displayLevel);
    const p1Color = winner === 'player' ? 'border-[#1dd15d]' : winner === 'opponent' ? 'border-[#f24242]' : 'border-slate-500';
    const p2Color = winner === 'opponent' ? 'border-[#1dd15d]' : winner === 'player' ? 'border-[#f24242]' : 'border-slate-500';

    return (
      <div className="h-[100dvh] overflow-y-auto bg-[#2a2a2a] flex flex-col max-w-md mx-auto relative z-20">
        <div className="pt-6 pb-2 text-center shrink-0 relative">
          <button
            onClick={() => {
              stopVictorySfx();
              stopDefeatSfx();
              navigate(categoryDetailPath(match.categoryId));
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Back to topic"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-5xl font-display font-black text-white tracking-widest uppercase drop-shadow-md">
            {winner === "player" ? "YOU WIN!" : winner === "opponent" ? "YOU LOSE!" : "DRAW!"}
          </h1>
        </div>

        <div className="flex justify-center items-start gap-4 px-4 mt-2 shrink-0">
          <div className="flex flex-col items-center flex-1">
            <img src={state.match.player1.avatarUrl} alt="" className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-[5px] ${p1Color} shadow-lg`} />
            <p className="mt-4 text-base sm:text-lg font-bold text-white text-center leading-tight">{state.match.player1.username}</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{playerTagline(state.match.player1)}</p>
          </div>

          <div className="flex items-center justify-center pt-8 sm:pt-10">
             <svg className="w-5 h-5 text-white/50" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
          </div>

          <div className="flex flex-col items-center flex-1">
            <img src={state.match.player2.avatarUrl} alt="" className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-[5px] ${p2Color} shadow-lg`} />
            <p className="mt-4 text-base sm:text-lg font-bold text-white text-center leading-tight">{state.match.player2.username}</p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{playerTagline(state.match.player2)}</p>
          </div>
        </div>

        <div className="px-2 sm:px-6 mt-8 shrink-0 w-full overflow-hidden">
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-5 px-2">
            
            {/* MATCH SCORE */}
            <div className="flex flex-col items-center min-w-[72px] sm:min-w-[84px]">
              <span className="text-[10px] sm:text-xs font-bold text-slate-100 uppercase tracking-widest text-center h-8 flex items-end justify-center mb-1.5 leading-tight">
                Match<br/>Score
              </span>
              <div className="w-full h-12 sm:h-14 px-2 rounded-xl border-2 border-[#00bcd4] text-[#00bcd4] flex items-center justify-center font-display font-black text-xl sm:text-2xl tabular-nums shadow-[0_4px_12px_rgba(0,188,212,0.15)] bg-[#1f1f1f]">
                {rawScore}
              </div>
            </div>

            {/* FINISH/LEVEL BONUS */}
            {winner === 'player' && levelBonus > 0 && (
              <div className="flex flex-col items-center min-w-[72px] sm:min-w-[84px]">
                <span className="text-[10px] sm:text-xs font-bold text-slate-100 uppercase tracking-widest text-center h-8 flex items-end justify-center mb-1.5 leading-tight">
                  Finish<br/>Bonus
                </span>
                <div className="w-full h-12 sm:h-14 px-2 rounded-xl border-2 border-[#ffc107] text-[#ffc107] flex items-center justify-center font-display font-black text-xl sm:text-2xl tabular-nums shadow-[0_4px_12px_rgba(255,193,7,0.15)] bg-[#1f1f1f]">
                  +{levelBonus}
                </div>
              </div>
            )}

            {/* TOTAL POINTS */}
            {winner === 'player' && levelBonus > 0 && (
              <div className="flex flex-col items-center min-w-[72px] sm:min-w-[84px]">
                <span className="text-[10px] sm:text-xs font-bold text-slate-100 uppercase tracking-widest text-center h-8 flex items-end justify-center mb-1.5 leading-tight">
                  Total<br/>Points
                </span>
                <div className="w-full h-12 sm:h-14 px-2 rounded-xl border-2 border-[#4caf50] text-[#4caf50] flex items-center justify-center font-display font-black text-xl sm:text-2xl tabular-nums shadow-[0_4px_12px_rgba(76,175,80,0.15)] bg-[#1f1f1f]">
                  {finalPts}
                </div>
              </div>
            )}

            {/* XP EARNED */}
            {winner !== 'opponent' && (
              <div className="flex flex-col items-center min-w-[72px] sm:min-w-[84px]">
                <span className="text-[10px] sm:text-xs font-bold text-slate-100 uppercase tracking-widest text-center h-8 flex items-end justify-center mb-1.5 leading-tight">
                  XP<br/>Earned
                </span>
                <div className="w-full h-12 sm:h-14 px-2 rounded-xl border-2 border-[#8bc34a] text-[#8bc34a] flex items-center justify-center font-display font-black text-xl sm:text-2xl tabular-nums shadow-[0_4px_12px_rgba(139,195,74,0.15)] bg-[#1f1f1f]">
                  +{xpGained}
                </div>
              </div>
            )}

            {/* DEDUCTED */}
            {winner === 'opponent' && xpPenalty > 0 && (
              <div className="flex flex-col items-center min-w-[72px] sm:min-w-[84px]">
                <span className="text-[10px] sm:text-xs font-bold text-slate-100 uppercase tracking-widest text-center h-8 flex items-end justify-center mb-1.5 leading-tight">
                  XP<br/>Lost
                </span>
                <div className="w-full h-12 sm:h-14 px-2 rounded-xl border-2 border-[#f24242] text-[#f24242] flex items-center justify-center font-display font-black text-xl sm:text-2xl tabular-nums shadow-[0_4px_12px_rgba(242,66,66,0.15)] bg-[#1f1f1f]">
                  -{xpPenalty}
                </div>
              </div>
            )}

            {/* XP */}
            <div className="flex flex-col items-center min-w-[72px] sm:min-w-[84px]">
              <span className="text-[10px] sm:text-xs font-bold text-slate-100 uppercase tracking-widest text-center h-8 flex items-end justify-center mb-1.5 leading-tight">
                Total<br/>XP
              </span>
              <div className="w-full h-12 sm:h-14 px-2 rounded-xl border-2 flex items-center justify-center font-display font-black text-xl sm:text-2xl tabular-nums bg-[#1f1f1f] border-[#b392ff] text-[#b392ff] shadow-[0_4px_12px_rgba(179,146,255,0.15)]">
                {displayXp.toLocaleString()}
              </div>
            </div>

          </div>
        </div>

        {levelPromotion && !showDedicatedAchievements && (
          <div className="mx-6 mb-2 rounded-2xl border border-violet-400/40 bg-violet-500/15 px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0">
              <span className="text-lg font-black text-white">{levelPromotion.to}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-violet-300 uppercase tracking-widest">Level up</p>
              <p className="font-bold text-white">
                Level {levelPromotion.from} → {levelPromotion.to}
              </p>
            </div>
          </div>
        )}

        <div className="shrink-0 flex-1 flex flex-col justify-center min-h-[160px]">
          <CircleProgress
            level={displayLevel}
            xpGained={netXp}
            xpToNext={xpToNext}
            progressPercent={ringProgress}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pb-8 mt-auto shrink-0">    
          <button onClick={() => {
              stopVictorySfx();
              stopDefeatSfx();
              navigate("/");
            }} 
            className="h-14 rounded-2xl font-black text-sm sm:text-base text-white active:translate-y-[4px] active:shadow-[0_0px_0_#a23900] transition-all duration-75 flex items-center justify-between px-4"
            style={{
              background: "linear-gradient(to bottom, #ffc107, #ff9800, #e65100)",
              boxShadow: "0 4px 0 #a23900, 0 8px 16px rgba(255,152,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}>
            <span className="drop-shadow-md">Return</span>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shadow-inner border border-white/30">
               <svg className="w-3.5 h-3.5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
            </div>
          </button>

          <button onClick={() => {
              stopVictorySfx();
              stopDefeatSfx();
              navigate(`/find-match/${match.categoryId}`);
            }} 
            className="h-14 rounded-2xl font-black text-sm sm:text-base text-white active:translate-y-[4px] active:shadow-[0_0px_0_#7b1a1a] transition-all duration-75 flex items-center justify-between px-4"
            style={{
              background: "linear-gradient(to bottom, #ff6b6b, #f65357, #c0392b)",
              boxShadow: "0 4px 0 #7b1a1a, 0 8px 16px rgba(246,83,87,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}>
            <span className="drop-shadow-md">Rematch</span>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shadow-inner border border-white/20">
               <svg className="w-3.5 h-3.5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
            </div>
          </button>

          <button 
            className="h-14 rounded-2xl font-black text-sm sm:text-base text-white active:translate-y-[4px] active:shadow-[0_0px_0_#008699] transition-all duration-75 flex items-center justify-between px-4"
            style={{
              background: "linear-gradient(to bottom, #4dd0e1, #00bcd4, #0097a7)",
              boxShadow: "0 4px 0 #008699, 0 8px 16px rgba(0,188,212,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}>
            <span className="drop-shadow-md">Chat</span>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] tracking-wide border border-white/30 shadow-inner">
               Hi
            </div>
          </button>

          <button 
            className="h-14 rounded-2xl font-black text-sm sm:text-base text-white active:translate-y-[4px] active:shadow-[0_0px_0_#338a3e] transition-all duration-75 flex items-center justify-between px-4"
            style={{
              background: "linear-gradient(to bottom, #81c784, #4caf50, #388e3c)",
              boxShadow: "0 4px 0 #338a3e, 0 8px 16px rgba(76,175,80,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}>
            <span className="drop-shadow-md">Share</span>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shadow-inner">
               <svg className="w-4 h-4 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Intro
  if (state.phase === "intro") {
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col max-w-md mx-auto relative bg-black font-sans">
        <button
          type="button"
          onClick={requestExitMatch}
          aria-label="Exit match"
          className="absolute left-3 top-3 z-40 w-9 h-9 rounded-full bg-white/95 hover:bg-white shadow-md flex items-center justify-center text-slate-700 border border-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {showExitConfirm && (
          <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
            <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6 border border-slate-100">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Leave this match?</h2>
              <p className="text-sm text-slate-500 mt-2 leading-snug">
                The match will end with the current score
                {" "}
                (<span className="font-bold text-slate-700 tabular-nums">{state.match.player1.score}</span>
                {" "}–{" "}
                <span className="font-bold text-slate-700 tabular-nums">{state.match.player2.score}</span>).
              </p>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isLeavingMatch}
                  className="h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 active:scale-[0.98] transition disabled:opacity-50"
                >
                  Keep playing
                </button>
                <button
                  type="button"
                  onClick={confirmExitMatch}
                  disabled={isLeavingMatch}
                  className="h-11 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {isLeavingMatch ? "Ending…" : "End match"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Half */}
        <motion.div 
          initial={{ y: "-100%" }} 
          animate={{ y: 0 }} 
          transition={{ type: "spring", bounce: 0, duration: 0.8 }}
          className="flex-1 relative overflow-hidden flex items-center"
          style={{ background: "linear-gradient(135deg, #f5a6b1, #b598d6, #7a94d8)" }}
        >
          <div className="absolute inset-0 bg-white/10 backdrop-blur-2xl" />
          
          <div className="relative z-10 w-full px-8 flex items-center gap-5">
            <div className="relative shrink-0">
              <img src={state.match.player1.avatarUrl} alt="" className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-[0_8px_16px_rgba(0,0,0,0.15)]" />
              <div className="absolute bottom-0 -right-2 w-7 h-7 rounded-full bg-white text-slate-800 text-[11px] font-black flex items-center justify-center shadow-md">
                 {state.match.player1.level || 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-3xl font-bold text-white drop-shadow-sm tracking-tight truncate">{state.match.player1.username}</p>
               <p className="text-sm text-white/95 font-semibold drop-shadow-sm truncate">{playerTagline(state.match.player1)}</p>
               <p className="text-sm text-white/95 font-semibold drop-shadow-sm">Level {state.match.player1.level || 1}</p>
               {/* <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-base leading-none drop-shadow-sm">🌍</span>
                  <span className="text-xs font-bold text-white tracking-wide drop-shadow-sm">Global</span>
               </div> */}
            </div>
          </div>
        </motion.div>

        {/* Bottom Half */}
        <motion.div 
          initial={{ y: "100%" }} 
          animate={{ y: 0 }} 
          transition={{ type: "spring", bounce: 0, duration: 0.8 }}
          className="flex-1 relative overflow-hidden flex items-center"
          style={{ background: "radial-gradient(circle at 70% 30%, #e05e26, #a11f3c, #142145)" }}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />
          
          <div className="relative z-10 w-full px-8 flex flex-row-reverse items-center gap-5 text-right">
            <div className="relative shrink-0">
              <img src={state.match.player2.avatarUrl} alt="" className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-[0_8px_16px_rgba(0,0,0,0.25)]" />
              <div className="absolute bottom-0 -right-2 w-7 h-7 rounded-full bg-white text-slate-800 text-[11px] font-black flex items-center justify-center shadow-md">
                 {state.match.player2.level || 1}
              </div>
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-3xl font-bold text-white drop-shadow-md tracking-tight truncate">{state.match.player2.username}</p>
               <p className="text-sm text-white/95 font-semibold drop-shadow-md truncate">{playerTagline(state.match.player2)}</p>
               <p className="text-sm text-white/95 font-semibold drop-shadow-md">Level {state.match.player2.level || 1}</p>
               <div className="flex items-center justify-end gap-2 mt-1.5">
                  <span className="text-base leading-none drop-shadow-md">🌍</span>
                  <span className="text-xs font-bold text-white tracking-wide drop-shadow-md">Global</span>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Divider Line & Lightning Bolt */}
        <motion.div 
          initial={{ scaleX: 0 }} 
          animate={{ scaleX: 1 }} 
          transition={{ delay: 0.4, duration: 0.5 }}
          className="absolute top-1/2 left-0 right-0 h-1 bg-white z-20 -translate-y-1/2 shadow-[0_0_10px_rgba(0,0,0,0.3)] origin-center" 
        />
        <motion.div 
          initial={{ scale: 0, opacity: 0, x: "-50%", y: "-50%" }} 
          animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }} 
          transition={{ type: "spring", bounce: 0.4, delay: 0.6 }}
          className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full border-[6px] border-white bg-black flex items-center justify-center z-30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
        >
          <svg className="w-14 h-14 fill-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" viewBox="0 0 20 20">
             <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
          </svg>
        </motion.div>

        {isOnline && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="absolute bottom-6 left-0 right-0 z-40 text-center text-sm font-bold text-white/90 drop-shadow-md px-6"
          >
            Waiting for opponent to join… Match starts when both players are active.
          </motion.p>
        )}
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
    <div className="h-[100dvh] overflow-hidden flex flex-col max-w-md mx-auto font-sans relative">
      {/* Exit / forfeit button */}
      <button
        type="button"
        onClick={requestExitMatch}
        aria-label="Exit match"
        className="absolute left-3 top-3 z-30 w-9 h-9 rounded-full bg-white/95 hover:bg-white shadow-md flex items-center justify-center text-slate-700 border border-slate-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {showExitConfirm && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6 border border-slate-100">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Leave this match?</h2>
            <p className="text-sm text-slate-500 mt-2 leading-snug">
              The match will end immediately with the current score
              {" "}
              (<span className="font-bold text-slate-700 tabular-nums">{p1.score}</span>
              {" "}–{" "}
              <span className="font-bold text-slate-700 tabular-nums">{p2.score}</span>).
              If you're tied, you'll forfeit the match.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                disabled={isLeavingMatch}
                className="h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 active:scale-[0.98] transition disabled:opacity-50"
              >
                Keep playing
              </button>
              <button
                type="button"
                onClick={confirmExitMatch}
                disabled={isLeavingMatch}
                className="h-11 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:scale-[0.98] transition disabled:opacity-60"
              >
                {isLeavingMatch ? "Ending…" : "End match"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1v1 header — names, taglines, colored scores */}
      <header className="flex px-4 pt-4 pb-3 gap-3 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="flex-1 flex gap-3 items-start min-w-0 pl-10">
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
              <p className="text-center text-xl font-bold leading-snug text-white px-2 mb-6 tracking-tight">{question.text}</p>

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
