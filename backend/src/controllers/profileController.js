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

    // Retroactively award basic stat-based achievements
    let modified = false;
    if (!user.unlockedAchievements) user.unlockedAchievements = [];
    const hasAch = (id) => user.unlockedAchievements.some((a) => a.id === id);

    if (user.wins >= 1 && !hasAch("a1")) {
      user.unlockedAchievements.push({ id: "a1", unlockedAt: new Date() });
      modified = true;
    }
    if (user.winStreak >= 3 && !hasAch("a2")) {
      user.unlockedAchievements.push({ id: "a2", unlockedAt: new Date() });
      modified = true;
    }
    if (user.followers?.length > 10 && !hasAch("a6")) {
      user.unlockedAchievements.push({ id: "a6", unlockedAt: new Date() });
      modified = true;
    }
    if (user.totalMatches > 70 && !hasAch("a7")) {
      user.unlockedAchievements.push({ id: "a7", unlockedAt: new Date() });
      modified = true;
    }
    if (modified) await user.save();

    let viewerId = null;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      const payload = verifyToken(auth.slice(7));
      if (payload?.sub) viewerId = payload.sub;
    }

    const profile = user.toProfile(viewerId);

    if (viewerId && viewerId !== userId) {
      const viewer = await User.findById(viewerId).select("following").lean();
      if (viewer) {
        profile.isFollowing = (viewer.following || []).some((id) => id.toString() === userId);
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
  body("avatarPrivacy").optional().isIn(["public", "private", "followers_only"]),
  body("avatarAllowedFollowers").optional().isArray(),
  body("avatarAllowedFollowers.*").optional().isMongoId(),
  body("publicKeyE2e").optional().isString(),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: errors.array()[0].msg });
    }

    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const allowed = ["displayName", "bio", "country", "favoriteCategory", "avatarPrivacy", "publicKeyE2e"];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key] === "followers_only" ? "private" : req.body[key];
        }
      }

      if (req.body.avatarAllowedFollowers !== undefined) {
        const followerIds = new Set((user.followers || []).map((id) => id.toString()));
        const incoming = Array.isArray(req.body.avatarAllowedFollowers)
          ? req.body.avatarAllowedFollowers
          : [];
        updates.avatarAllowedFollowers = incoming.filter(
          (id) => mongoose.Types.ObjectId.isValid(id) && followerIds.has(id)
        );
      }

      if (updates.avatarPrivacy === "public") {
        updates.avatarAllowedFollowers = [];
      }

      Object.assign(user, updates);
      await user.save();

      return res.json({ user: user.toProfile(req.user._id.toString()) });
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
        opponentId: opp.userId.toString(),
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

// GET /api/profile/:userId/followers
const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await User.findById(userId)
      .select("followers")
      .populate("followers", "_id username displayName avatarUrl level country")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const followers = (user.followers || []).map((u) => ({
      id: u._id.toString(),
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username)}`,
      level: u.level || 1,
      country: u.country || "",
    }));

    return res.json({ followers });
  } catch (err) {
    console.error("[Profile] getFollowers error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getProfile, updateProfile, getMatchHistory, getFollowers };
