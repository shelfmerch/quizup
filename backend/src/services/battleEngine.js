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

  let p1Penalty = 0;
  let p2Penalty = 0;

  if (result1 === "win" || result1 === "loss") {
    try {
      const user1 = await User.findById(state.player1.userId).select('level');
      const user2 = await User.findById(state.player2.userId).select('level');
      const level1 = user1 ? user1.level : 1;
      const level2 = user2 ? user2.level : 1;
      const scoreDiff = Math.abs(p1Score - p2Score);

      if (result1 === "loss") {
        let scaling = 1 + (level1 - level2) * 0.1;
        scaling = Math.max(0.2, Math.min(scaling, 2.5));
        p1Penalty = Math.floor(scoreDiff * scaling);
      } else {
        let scaling = 1 + (level2 - level1) * 0.1;
        scaling = Math.max(0.2, Math.min(scaling, 2.5));
        p2Penalty = Math.floor(scoreDiff * scaling);
      }
    } catch (e) {
      console.error("[BattleEngine] Error calculating dynamic penalty:", e.message);
    }
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
  await updateUserStats(state.player1.userId, result1, state.player1.score, state.categoryId, p1Penalty);
  await updateUserStats(state.player2.userId, result2, state.player2.score, state.categoryId, p2Penalty);

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

  // Emit match_end to the room
  io.to(matchId).emit("match_end", {
    matchId,
    winnerId,
    player1: { userId: state.player1.userId, score: p1Score },
    player2: { userId: state.player2.userId, score: p2Score },
    endReason,
  });

  // Cleanup Redis
  await removeActiveMatch(matchId);
  await clearUserMatch(state.player1.userId);
  await clearUserMatch(state.player2.userId);
};

/**
 * Update a user's stats after a match completes.
 */
const updateUserStats = async (userId, result, score, categoryId, penalty = 0) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.totalMatches += 1;
    const XP_WIN = 100, XP_LOSS = 20, XP_DRAW = 50;

    if (result === "win") {
      user.wins += 1;
      user.winStreak += 1;
      if (user.winStreak > user.bestWinStreak) user.bestWinStreak = user.winStreak;
      user.addXP(XP_WIN + Math.floor(score / 10));
    } else if (result === "loss") {
      user.losses += 1;
      user.winStreak = 0;
      user.addXP(XP_LOSS);
      if (penalty > 0) {
        user.xp -= penalty;
        if (user.xp < 0) user.xp = 0; // Prevent negative XP (Level Floor mechanic)
      }
    } else {
      user.draws += 1;
      user.winStreak = 0;
      user.addXP(XP_DRAW);
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
