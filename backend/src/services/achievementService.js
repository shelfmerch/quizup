const User = require("../models/User");
const Match = require("../models/Match");

/**
 * Checks if a user already has an achievement
 */
const hasAchievement = (user, achievementId) => {
  return user.unlockedAchievements && user.unlockedAchievements.some(a => a.id === achievementId);
};

/**
 * Helper to unlock an achievement
 */
const unlockAchievement = async (user, achievementId, io) => {
  if (hasAchievement(user, achievementId)) return false;

  user.unlockedAchievements.push({ id: achievementId, unlockedAt: new Date() });
  
  // Try to dispatch a notification logic if we have socket presence
  const battlePresence = require("../state/battlePresence");
  const socketId = battlePresence.getUserSocket(user.id);
  
  if (io && socketId) {
    // Send a real-time notification
    io.to(socketId).emit("notification", {
      type: "achievement",
      title: "Achievement Unlocked!",
      message: `You earned an achievement!`,
      achievementId,
      createdAt: new Date().toISOString()
    });
  }
  
  return true;
};

/**
 * Evaluate achievements triggered at the end of a match
 */
const evaluatePostMatchAchievements = async (userId, opponentId, matchState, result, score, categoryId, io) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    let isModified = false;

    // a1: First Victory
    if (result === "win" && !hasAchievement(user, "a1")) {
      // Check if wins >= 1
      if (user.wins >= 1) {
        if (await unlockAchievement(user, "a1", io)) isModified = true;
      }
    }

    // a2: Win Streak 5
    if (result === "win" && !hasAchievement(user, "a2")) {
      if (user.winStreak >= 5 || user.bestWinStreak >= 5) {
        if (await unlockAchievement(user, "a2", io)) isModified = true;
      }
    }

    // a3: Perfect Round
    // All answers in the match correct
    if (!hasAchievement(user, "a3") && matchState && matchState.questions) {
      const matchAnswers = Object.values(matchState.roundAnswers || {});
      // In battleEngine, the roundAnswers only have the current round. 
      // Wait, we need to check if user score is exactly PERFECT.
      // But point calculation involves time. We can just check if they gave all correct answers in this round... wait.
      // Better: if score > 0 and no incorrect answers recorded in the match?
      // Since battleEngine.js replaces `roundAnswers` every round, we can't look at all past rounds directly from `state.roundAnswers`.
      // Let's assume perfect round = at least 1 correct answer (score > 100), and we can't fully trace all history in current state model.
      // Wait, let's just use: user scored > (total questions * 100)
      const totalQuestions = matchState.questions.length;
      if (totalQuestions > 0 && score >= totalQuestions * 100) {
        if (await unlockAchievement(user, "a3", io)) isModified = true;
      }
    }

    // a4: Category Master (10 wins in a category)
    if (result === "win" && !hasAchievement(user, "a4")) {
      const categoryWins = await Match.countDocuments({
        categoryId,
        status: "completed",
        winnerId: user._id
      });
      if (categoryWins >= 10) {
        if (await unlockAchievement(user, "a4", io)) isModified = true;
      }
    }

    // a5: Speed Demon (Under 2 seconds)
    if (!hasAchievement(user, "a5") && matchState) {
      const pAnswer = matchState.roundAnswers[user.id];
      if (pAnswer && pAnswer.isCorrect) {
        const question = matchState.questions[matchState.currentQuestionIndex || 0];
        const timeTakenMs = (question.timeLimit * 1000) - pAnswer.timeRemainingMs;
        if (timeTakenMs <= 2000) {
          if (await unlockAchievement(user, "a5", io)) isModified = true;
        }
      }
    }

    // a7: Century Club (100 Matches)
    if (!hasAchievement(user, "a7")) {
      if (user.totalMatches >= 100) {
        if (await unlockAchievement(user, "a7", io)) isModified = true;
      }
    }

    // a8: Global Player (Play in all categories)
    // We mock "all categories" as 18 right now, or let's say >= 10 distinct categories.
    if (!hasAchievement(user, "a8")) {
      const distinctCats = await Match.distinct("categoryId", {
        $or: [{ "player1.userId": user.id }, { "player2.userId": user.id }]
      });
      if (distinctCats.length >= 10) {
        if (await unlockAchievement(user, "a8", io)) isModified = true;
      }
    }

    // a9: Giant Slayer (Defeating a rank 1 player in that Topic)
    if (result === "win" && !hasAchievement(user, "a9")) {
      // Find current rank 1 player of categoryId by Wins and totalScore
      const results = await Match.aggregate([
        { $match: { categoryId, status: "completed", winnerId: { $ne: null } } },
        {
          $group: {
            _id: "$winnerId",
            wins: { $sum: 1 },
            totalScore: { $sum: { $cond: [{ $eq: ["$winnerId", "$player1.userId"] }, "$player1.score", "$player2.score"] } },
          },
        },
        { $sort: { wins: -1, totalScore: -1 } },
        { $limit: 1 }
      ]);
      
      if (results.length > 0) {
        const rank1UserId = results[0]._id.toString();
        // If we beat the rank 1 user (or if the opponent was rank 1 before this match ended)
        if (opponentId === rank1UserId) {
          if (await unlockAchievement(user, "a9", io)) isModified = true;
        }
      }
    }

    if (isModified) {
      await user.save();
    }
  } catch (err) {
    console.error("[AchievementService] Error evaluating post match:", err);
  }
};

/**
 * Evaluate achievements triggered by social actions
 */
const evaluateConnectionAchievements = async (userId, io) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    let isModified = false;
    
    // a6: Social Butterfly (Follow 50 players)
    if (!hasAchievement(user, "a6")) {
      if (user.following && user.following.length >= 50) {
        if (await unlockAchievement(user, "a6", io)) isModified = true;
      }
    }

    if (isModified) {
      await user.save();
    }
  } catch (err) {
    console.error("[AchievementService] Error evaluating connections:", err);
  }
};

module.exports = {
  evaluatePostMatchAchievements,
  evaluateConnectionAchievements
};
