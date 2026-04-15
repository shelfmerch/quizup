const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const Match = require("../models/Match");
const Achievement = require("../models/Achievement");
const mongoose = require("mongoose");
const { verifyToken } = require("../utils/jwt");

// GET /api/profile/:userId
const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const achievements = await Achievement.find({ userId }).lean();

    const profile = user.toProfile();
    profile.achievements = achievements.map((a) => ({
      id: a.achievementId,
      name: a.name,
      description: a.description,
      icon: a.icon,
      isUnlocked: true,
      unlockedAt: a.unlockedAt,
    }));

    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      const payload = verifyToken(auth.slice(7));
      if (payload && payload.sub && payload.sub !== userId) {
        const viewer = await User.findById(payload.sub).select("following").lean();
        if (viewer) {
          profile.isFollowing = (viewer.following || []).some((id) => id.toString() === userId);
        }
      }
    }

    return res.json({ user: profile });
  } catch (err) {
    console.error("[Profile] getProfile error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// PATCH /api/profile  (protected)
const updateProfile = [
  body("displayName").optional().trim().isLength({ max: 50 }),
  body("bio").optional().trim().isLength({ max: 200 }),
  body("country").optional().trim().isLength({ max: 60 }),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array()[0].msg });
    }

    try {
      const allowed = ["displayName", "bio", "country", "favoriteCategory"];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      return res.json({ user: user.toProfile() });
    } catch (err) {
      console.error("[Profile] updateProfile error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  },
];

// GET /api/profile/:userId/history
const getMatchHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const uid = new mongoose.Types.ObjectId(userId);

    const matches = await Match.find({
      $or: [{ "player1.userId": uid }, { "player2.userId": uid }],
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const history = matches.map((m) => {
      const isP1 = m.player1.userId.toString() === userId;
      const me = isP1 ? m.player1 : m.player2;
      const opp = isP1 ? m.player2 : m.player1;

      let result = "draw";
      if (m.winnerId) {
        result = m.winnerId.toString() === userId ? "win" : "loss";
      }

      return {
        matchId: m._id.toString(),
        opponentName: opp.username,
        opponentAvatar: opp.avatarUrl,
        categoryName: m.categoryName,
        playerScore: me.score,
        opponentScore: opp.score,
        result,
        playedAt: m.completedAt || m.updatedAt,
      };
    });

    return res.json({ history, page, limit });
  } catch (err) {
    console.error("[Profile] getMatchHistory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getProfile, updateProfile, getMatchHistory };
