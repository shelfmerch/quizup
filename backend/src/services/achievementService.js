const mongoose = require("mongoose");
const User = require("../models/User");
const Match = require("../models/Match");

const ACHIEVEMENT_META = {
  a1: { name: "First Victory", message: "You won your first match!" },
  a2: { name: "Win Streak 5", message: "You won 3 matches in a row!" },
  a3: { name: "Perfect Round", message: "You answered every question correctly!" },
  a4: { name: "Category Master", message: "You reached the top 3 in a category!" },
  a6: { name: "Social Butterfly", message: "You have more than 10 followers!" },
  a7: { name: "Century Club", message: "You played more than 70 matches!" },
  a8: { name: "Global Player", message: "You won in more than 10 categories!" },
  a9: { name: "Giant Slayer", message: "You defeated the #1 player in a topic!" },
};

const hasAchievement = (user, achievementId) =>
  user.unlockedAchievements?.some((a) => a.id === achievementId);

const unlockAchievement = async (user, achievementId, io) => {
  if (hasAchievement(user, achievementId)) return false;

  user.unlockedAchievements.push({ id: achievementId, unlockedAt: new Date() });

  const meta = ACHIEVEMENT_META[achievementId];
  if (io) {
    const uid = user._id ? user._id.toString() : String(user.id);
    io.to(`user:${uid}`).emit("notification", {
      type: "achievement",
      title: "Achievement Unlocked!",
      message: meta ? `You earned ${meta.name}!` : "You earned an achievement!",
      achievementId,
      achievementName: meta?.name,
      createdAt: new Date().toISOString(),
    });
  }

  return true;
};

/** Category leaderboard user ids (wins desc, score desc). */
const getCategoryLeaderboardUserIds = async (categoryId, { limit = 50, excludeMatchId = null } = {}) => {
  const matchFilter = { categoryId, status: "completed", winnerId: { $ne: null } };
  if (excludeMatchId) {
    matchFilter._id = { $ne: new mongoose.Types.ObjectId(excludeMatchId) };
  }

  const results = await Match.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: "$winnerId",
        wins: { $sum: 1 },
        totalScore: {
          $sum: {
            $cond: [
              { $eq: ["$winnerId", "$player1.userId"] },
              "$player1.score",
              "$player2.score",
            ],
          },
        },
      },
    },
    { $sort: { wins: -1, totalScore: -1 } },
    { $limit: limit },
  ]);

  return results.map((r) => r._id.toString());
};

const hadPerfectRound = (matchState, userId) => {
  const uid = userId.toString();
  const answers = matchState?.playerMatchAnswers?.[uid];
  const totalQuestions = matchState?.questions?.length ?? 0;
  if (!answers?.length || totalQuestions === 0) return false;
  return answers.length === totalQuestions && answers.every((a) => a.isCorrect);
};

/**
 * Evaluate achievements triggered at the end of a match (after user stats are saved).
 */
const evaluatePostMatchAchievements = async (
  userId,
  opponentId,
  matchState,
  result,
  _score,
  categoryId,
  io
) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const uid = userId.toString();
    const matchId = matchState?.matchId || matchState?._id?.toString();
    let isModified = false;

    // First Victory — first match won
    if (result === "win" && !hasAchievement(user, "a1") && user.wins >= 1) {
      if (await unlockAchievement(user, "a1", io)) isModified = true;
    }

    // Win Streak 5 (title) — 3 consecutive wins
    if (result === "win" && !hasAchievement(user, "a2") && user.winStreak >= 3) {
      if (await unlockAchievement(user, "a2", io)) isModified = true;
    }

    // Perfect Round — all questions correct in this match
    if (!hasAchievement(user, "a3") && hadPerfectRound(matchState, uid)) {
      if (await unlockAchievement(user, "a3", io)) isModified = true;
    }

    // Category Master — ranked in top 3 for this category (includes current match)
    if (!hasAchievement(user, "a4")) {
      const top3 = await getCategoryLeaderboardUserIds(categoryId, { limit: 3 });
      if (top3.includes(uid)) {
        if (await unlockAchievement(user, "a4", io)) isModified = true;
      }
    }

    // Century Club — more than 70 matches played
    if (!hasAchievement(user, "a7") && user.totalMatches > 70) {
      if (await unlockAchievement(user, "a7", io)) isModified = true;
    }

    // Global Player — won in more than 10 distinct categories
    if (!hasAchievement(user, "a8")) {
      const winCategories = await Match.distinct("categoryId", {
        status: "completed",
        winnerId: user._id,
      });
      if (winCategories.length > 10) {
        if (await unlockAchievement(user, "a8", io)) isModified = true;
      }
    }

    // Giant Slayer — beat the category #1 player (rank before this match ended)
    if (result === "win" && !hasAchievement(user, "a9") && opponentId && matchId) {
      const preMatchTop = await getCategoryLeaderboardUserIds(categoryId, {
        limit: 1,
        excludeMatchId: matchId,
      });
      if (preMatchTop.length > 0 && preMatchTop[0] === opponentId.toString()) {
        if (await unlockAchievement(user, "a9", io)) isModified = true;
      }
    }

    // Social Butterfly — checked here too in case follower count changed outside follow API
    if (!hasAchievement(user, "a6") && user.followers?.length > 10) {
      if (await unlockAchievement(user, "a6", io)) isModified = true;
    }

    if (isModified) await user.save();
  } catch (err) {
    console.error("[AchievementService] Error evaluating post match:", err);
  }
};

/**
 * Evaluate achievements triggered by social actions (new follower).
 */
const evaluateConnectionAchievements = async (userId, io) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    let isModified = false;

    // Social Butterfly — more than 10 followers
    if (!hasAchievement(user, "a6") && user.followers?.length > 10) {
      if (await unlockAchievement(user, "a6", io)) isModified = true;
    }

    if (isModified) await user.save();
  } catch (err) {
    console.error("[AchievementService] Error evaluating connections:", err);
  }
};

module.exports = {
  evaluatePostMatchAchievements,
  evaluateConnectionAchievements,
  ACHIEVEMENT_META,
};
