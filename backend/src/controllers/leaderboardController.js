const User = require("../models/User");

// GET /api/leaderboard  — global top 50 by total XP (cumulative score proxy)
const getGlobalLeaderboard = async (req, res) => {
  try {
    const users = await User.find({ totalMatches: { $gt: 0 } })
      .sort({ xp: -1, wins: -1 })
      .limit(50)
      .lean();

    const entries = users.map((u, i) => ({
      rank: i + 1,
      userId: u._id.toString(),
      username: u.username,
      avatarUrl: u.avatarUrl,
      score: u.xp,
      wins: u.wins,
      level: u.level,
      country: u.country || "🌍",
    }));

    return res.json({ leaderboard: entries });
  } catch (err) {
    console.error("[Leaderboard] global error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// GET /api/leaderboard/:categoryId  — most wins per category from match history
const getCategoryLeaderboard = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const Match = require("../models/Match");

    // Aggregate: count wins per player in this category
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
      { $limit: 50 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ]);

    const entries = results.map((r, i) => ({
      rank: i + 1,
      userId: r._id.toString(),
      username: r.user.username,
      avatarUrl: r.user.avatarUrl,
      score: r.totalScore,
      wins: r.wins,
      level: r.user.level,
      country: r.user.country || "🌍",
    }));

    return res.json({ leaderboard: entries });
  } catch (err) {
    console.error("[Leaderboard] category error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getGlobalLeaderboard, getCategoryLeaderboard };
