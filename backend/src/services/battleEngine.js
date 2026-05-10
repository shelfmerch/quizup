const {
  getActiveMatch,
  updateActiveMatch,
  removeActiveMatch,
  clearUserMatch,
} = require("./matchmakingService");
const Match = require("../models/Match");
const User = require("../models/User");
const mongoose = require("mongoose");
const { evaluatePostMatchAchievements } = require("./achievementService");
const { recordMatchQuestionExposure } = require("./userQuestionExposure");

// Active timers: matchId → NodeJS timeout reference
const questionTimers = new Map();

// Grace period timers for disconnected players: matchId+userId → timeout
const disconnectTimers = new Map();

const GRACE_PERIOD_MS = 15_000; // 15 seconds to reconnect
const BETWEEN_QUESTION_DELAY_MS = 3_000; // 3s between round_end and next question_start

/**
 * Calculate points for a correct answer.
 * Server is the ONLY place that does this.
 */
const calcPoints = (isCorrect, timeRemainingMs, timeLimitSec, pointsMultiplier = 1) => {
  if (!isCorrect) return 0;
  const mult = Number(pointsMultiplier) > 0 ? Number(pointsMultiplier) : 1;

  const elapsedMs = (timeLimitSec * 1000) - timeRemainingMs;
  let timeBonus = 0;
  if (elapsedMs <= 2000) {
    timeBonus = 100;
  } else {
    timeBonus = Math.floor((timeRemainingMs / (timeLimitSec * 1000)) * 100);
  }

  return Math.round((100 + timeBonus) * mult);
};

/**
 * Send the next question to both players in the match room.
 * Called after room is ready (both joined) or after a round ends.
 */
const sendNextQuestion = async (matchId, io) => {
  const state = await getActiveMatch(matchId);
  if (!state || state.status !== "in_progress") return;

  const nextIndex = state.currentQuestionIndex + 1;

  if (nextIndex >= state.questions.length) {
    // All questions done — end the match
    await finalizeMatch(matchId, io, "completed");
    return;
  }

  const question = state.questions[nextIndex];
  const timerEndsAt = Date.now() + question.timeLimit * 1000;

  // Update state — clear previous round answers, advance index
  await updateActiveMatch(matchId, (s) => ({
    ...s,
    currentQuestionIndex: nextIndex,
    roundAnswers: {},
    timerEndsAt,
  }));

  // Emit question to room — NEVER send correctIndex to client
  io.to(matchId).emit("question_start", {
    questionIndex: nextIndex,
    totalQuestions: state.questions.length,
    question: {
      id: question.id,
      text: question.text,
      options: question.options,
      timeLimit: question.timeLimit,
      imageUrl: question.imageUrl || null,
      questionType: question.questionType || (question.imageUrl ? "IMAGE" : "TEXT"),
      isBonusRound: Boolean(question.isBonusRound),
      pointsMultiplier: question.pointsMultiplier != null ? question.pointsMultiplier : question.isBonusRound ? 2 : 1,
    },
    timerEndsAt, // absolute server timestamp — client uses for display only
  });

  // Server-side timer: auto-close question when time expires
  const timer = setTimeout(
    () => handleQuestionTimeout(matchId, io),
    question.timeLimit * 1000 + 200 // +200ms buffer for network latency
  );
  questionTimers.set(matchId, timer);
};

/**
 * Handle a player's answer submission.
 * Idempotent — duplicate submissions for same player are ignored.
 */
const handleAnswer = async (matchId, userId, selectedIndex, io) => {
  const state = await getActiveMatch(matchId);
  if (!state || state.status !== "in_progress") return;
  if (state.currentQuestionIndex < 0) return;

  // Ignore if this player already answered this round
  if (state.roundAnswers[userId]) return;

  const question = state.questions[state.currentQuestionIndex];
  const now = Date.now();
  const timeRemainingMs = Math.max(0, state.timerEndsAt - now);
  const isCorrect = selectedIndex === question.correctIndex;
  const mult = question.pointsMultiplier != null ? question.pointsMultiplier : question.isBonusRound ? 2 : 1;
  const points = calcPoints(isCorrect, timeRemainingMs, question.timeLimit, mult);

  // Determine which player slot
  const isP1 = state.player1.userId === userId;
  const isP2 = state.player2.userId === userId;
  if (!isP1 && !isP2) return; // Unknown player

  const updatedState = await updateActiveMatch(matchId, (s) => {
    const newRoundAnswers = { ...s.roundAnswers, [userId]: { selectedIndex, timeRemainingMs, isCorrect, points } };
    const playerKey = isP1 ? "player1" : "player2";
    const updatedPlayer = {
      ...s[playerKey],
      score: s[playerKey].score + points,
    };
    return { ...s, roundAnswers: newRoundAnswers, [playerKey]: updatedPlayer };
  });

  // Emit answer_result only to the answering player
  const answerSocket = isP1 ? state.player1.socketId : state.player2.socketId;
  io.to(answerSocket).emit("answer_result", {
    isCorrect,
    pointsEarned: points,
    correctIndex: question.correctIndex,
  });

  // Check if BOTH players have answered
  const bothAnswered =
    updatedState.roundAnswers[state.player1.userId] &&
    updatedState.roundAnswers[state.player2.userId];

  if (bothAnswered) {
    // Cancel the server timer — both answered before timeout
    const timer = questionTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      questionTimers.delete(matchId);
    }
    await endRound(matchId, io, updatedState);
  }
};

/**
 * Called when the server timer fires (not all players answered in time).
 */
const handleQuestionTimeout = async (matchId, io) => {
  questionTimers.delete(matchId);
  const state = await getActiveMatch(matchId);
  if (!state || state.status !== "in_progress") return;

  const question = state.questions[state.currentQuestionIndex];

  // For any player who didn't answer, record a timeout (selectedIndex: null, 0 pts)
  const updatedState = await updateActiveMatch(matchId, (s) => {
    const p1Answered = !!s.roundAnswers[s.player1.userId];
    const p2Answered = !!s.roundAnswers[s.player2.userId];
    const patch = {};
    if (!p1Answered) patch[s.player1.userId] = { selectedIndex: null, timeRemainingMs: 0, isCorrect: false, points: 0 };
    if (!p2Answered) patch[s.player2.userId] = { selectedIndex: null, timeRemainingMs: 0, isCorrect: false, points: 0 };
    return { ...s, roundAnswers: { ...s.roundAnswers, ...patch } };
  });

  await endRound(matchId, io, updatedState);
};

/**
 * Emit round_end with scores, then schedule the next question.
 */
const endRound = async (matchId, io, state) => {
  const question = state.questions[state.currentQuestionIndex];

  io.to(matchId).emit("round_end", {
    correctIndex: question.correctIndex,
    player1Score: state.player1.score,
    player2Score: state.player2.score,
    roundAnswers: {
      [state.player1.userId]: state.roundAnswers[state.player1.userId] || null,
      [state.player2.userId]: state.roundAnswers[state.player2.userId] || null,
    },
  });

  // Schedule next question after a short reveal pause
  setTimeout(() => sendNextQuestion(matchId, io), BETWEEN_QUESTION_DELAY_MS);
};

/**
 * Finalize a match: persist to MongoDB, update user stats, emit match_end.
 */
const finalizeMatch = async (matchId, io, endReason = "completed") => {
  // Clear any lingering timer
  const timer = questionTimers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(matchId);
  }

  const state = await getActiveMatch(matchId);
  if (!state) return; // Already finalized

  // Mark as finalizing to prevent double-calls
  await updateActiveMatch(matchId, { status: "finalizing" });

  const p1Score = state.player1.score;
  const p2Score = state.player2.score;

  let winnerId = null;
  let result1, result2;
  if (p1Score > p2Score) {
    winnerId = state.player1.userId;
    result1 = "win"; result2 = "loss";
  } else if (p2Score > p1Score) {
    winnerId = state.player2.userId;
    result1 = "loss"; result2 = "win";
  } else {
    result1 = result2 = "draw";
  }

  // ── Level differential bonus (winner only) ────────────────────────────────
  // If the winner beats a higher-level opponent they earn +10% of their match
  // score per level of difference.  E.g. beating someone 2 levels above gives
  // an extra 20% of the winner's raw score on top.
  let level1 = 1, level2 = 1;
  try {
    const [u1, u2] = await Promise.all([
      User.findById(state.player1.userId).select('level'),
      User.findById(state.player2.userId).select('level'),
    ]);
    level1 = u1 ? u1.level : 1;
    level2 = u2 ? u2.level : 1;
  } catch (e) {
    console.error("[BattleEngine] Error fetching player levels:", e.message);
  }

  let p1LevelBonus = 0, p2LevelBonus = 0;
  if (result1 === "win" && level2 > level1) {
    p1LevelBonus = Math.floor(p1Score * (level2 - level1) * 0.10);
  } else if (result2 === "win" && level1 > level2) {
    p2LevelBonus = Math.floor(p2Score * (level1 - level2) * 0.10);
  }

  // Final points = match score + level bonus
  const p1FinalPoints = p1Score + p1LevelBonus;
  const p2FinalPoints = p2Score + p2LevelBonus;

  // Winner earns 10 % of their final points as XP.
  // Loser earns 0 XP from the match — only the defeat penalty is applied.
  // Draw earns 10% of their raw match score as XP.
  const p1XpGained = result1 === "loss" ? 0 : Math.floor(p1FinalPoints * 0.10);
  const p2XpGained = result2 === "loss" ? 0 : Math.floor(p2FinalPoints * 0.10);

  // ── Defeat penalty ────────────────────────────────────────────────────────
  // Deducted from the loser's ACCUMULATED XP (not match XP, since loser gets 0).
  //
  //   basePenalty  = floor(|winnerScore − loserScore| × 0.10)
  //   levelDiff    = max(0, loserLevel − winnerLevel)   ← only stings if loser outranked winner
  //   penalty      = basePenalty × (1 + levelDiff)
  //
  // Examples (scoreDiff=200, basePenalty=20):
  //   Same level            → 1×20 = 20 XP deducted
  //   Loser 1 level higher  → 2×20 = 40 XP deducted
  //   Loser 2 levels higher → 3×20 = 60 XP deducted
  const pointsDiff = Math.abs(p1Score - p2Score);
  const basePenalty = Math.floor(pointsDiff * 0.10);
  let p1Penalty = 0, p2Penalty = 0;

  if (result1 === "loss") {
    const levelDiff = Math.max(0, level1 - level2);
    p1Penalty = basePenalty * (1 + levelDiff);
  } else if (result2 === "loss") {
    const levelDiff = Math.max(0, level2 - level1);
    p2Penalty = basePenalty * (1 + levelDiff);
  }

  // Persist match to MongoDB
  await Match.findByIdAndUpdate(matchId, {
    status: endReason === "abandoned" ? "abandoned" : "completed",
    winnerId: winnerId ? new mongoose.Types.ObjectId(winnerId) : null,
    completedAt: new Date(),
    "player1.score": p1Score,
    "player2.score": p2Score,
  });

  // Update user stats for both players
  await updateUserStats(state.player1.userId, result1, state.player1.score, state.categoryId, p1XpGained, p1Penalty);
  await updateUserStats(state.player2.userId, result2, state.player2.score, state.categoryId, p2XpGained, p2Penalty);

  // Evaluate achievements
  await evaluatePostMatchAchievements(state.player1.userId, state.player2.userId, state, result1, state.player1.score, state.categoryId, io);
  await evaluatePostMatchAchievements(state.player2.userId, state.player1.userId, state, result2, state.player2.score, state.categoryId, io);

  try {
    if (state.questions && state.questions.length) {
      await recordMatchQuestionExposure(state.player1.userId, state.questions);
      await recordMatchQuestionExposure(state.player2.userId, state.questions);
    }
  } catch (e) {
    console.error("[BattleEngine] recordMatchQuestionExposure:", e.message);
  }

  // Emit match_end to the room — include full XP breakdown so the UI can render it
  io.to(matchId).emit("match_end", {
    matchId,
    winnerId,
    player1: {
      userId: state.player1.userId,
      score: p1Score,
      levelBonus: p1LevelBonus,
      finalPoints: p1FinalPoints,
      xpGained: p1XpGained,
      xpPenalty: p1Penalty,             // deducted from accumulated XP (0 for winner)
      netXp: p1XpGained - p1Penalty,    // can be negative (display only; floor applied in DB)
    },
    player2: {
      userId: state.player2.userId,
      score: p2Score,
      levelBonus: p2LevelBonus,
      finalPoints: p2FinalPoints,
      xpGained: p2XpGained,
      xpPenalty: p2Penalty,
      netXp: p2XpGained - p2Penalty,
    },
    endReason,
  });

  // Cleanup Redis
  await removeActiveMatch(matchId);
  await clearUserMatch(state.player1.userId);
  await clearUserMatch(state.player2.userId);
};

/**
 * Update a user's stats after a match completes.
 * @param {string} userId
 * @param {'win'|'loss'|'draw'} result
 * @param {number} score      - raw in-game match score
 * @param {string} categoryId
 * @param {number} xpGained   - pre-computed XP to ADD (10% of finalPoints)
 * @param {number} penalty    - XP to DEDUCT from accumulated total (losers only)
 */
const updateUserStats = async (userId, result, score, categoryId, xpGained = 0, penalty = 0) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.totalMatches += 1;

    if (result === "win") {
      user.wins += 1;
      user.winStreak += 1;
      if (user.winStreak > user.bestWinStreak) user.bestWinStreak = user.winStreak;
    } else if (result === "loss") {
      user.losses += 1;
      user.winStreak = 0;
    } else {
      user.draws += 1;
      user.winStreak = 0;
    }

    // Step 1: credit the XP earned this match (10% of finalPoints for everyone)
    user.addXP(xpGained);

    // Step 2: for losers, deduct the defeat penalty from accumulated XP
    if (result === "loss" && penalty > 0) {
      user.xp = Math.max(0, user.xp - penalty);
    }

    if (!user.favoriteCategory) user.favoriteCategory = categoryId;
    user.lastActive = new Date();
    await user.save();
  } catch (err) {
    console.error(`[BattleEngine] updateUserStats error for ${userId}:`, err.message);
  }
};

/**
 * Start the battle for a given match (both players are in the room).
 */
const startMatch = async (matchId, io) => {
  await updateActiveMatch(matchId, { status: "in_progress" });

  io.to(matchId).emit("battle_start", { matchId });

  // Small delay before first question
  setTimeout(() => sendNextQuestion(matchId, io), 1500);
};

/**
 * Handle a player disconnecting mid-match.
 * Gives opponent a grace period; if they don't return, match is abandoned.
 */
const handlePlayerDisconnect = async (matchId, userId, io) => {
  const state = await getActiveMatch(matchId);
  if (!state || state.status === "finalizing" || state.status === "completed") return;

  // Notify the other player
  io.to(matchId).emit("opponent_disconnected", {
    userId,
    graceMs: GRACE_PERIOD_MS,
  });

  const timerKey = `${matchId}:${userId}`;
  const existing = disconnectTimers.get(timerKey);
  if (existing) clearTimeout(existing);

  const graceTimer = setTimeout(async () => {
    disconnectTimers.delete(timerKey);
    // If still disconnected and match still active → abandon
    const current = await getActiveMatch(matchId);
    if (current && current.status === "in_progress") {
      await finalizeMatch(matchId, io, "abandoned");
    }
  }, GRACE_PERIOD_MS);

  disconnectTimers.set(timerKey, graceTimer);
};

/**
 * Cancel the disconnect grace timer for a reconnecting player.
 */
const cancelDisconnectTimer = (matchId, userId) => {
  const timerKey = `${matchId}:${userId}`;
  const timer = disconnectTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(timerKey);
  }
};

module.exports = {
  startMatch,
  handleAnswer,
  handlePlayerDisconnect,
  cancelDisconnectTimer,
  finalizeMatch,
};
