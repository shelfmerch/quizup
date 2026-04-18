const mongoose = require("mongoose");
const User = require("../models/User");
const { evaluateConnectionAchievements } = require("../services/achievementService");

// POST /api/follow/:userId
const followUser = async (req, res) => {
  try {
    const { userId: targetId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const meId = req.user._id.toString();
    if (targetId === meId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const target = await User.findById(targetId).select("_id");
    if (!target) return res.status(404).json({ error: "User not found" });

    await User.findByIdAndUpdate(meId, { $addToSet: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: meId } });

    // Evaluate social achievements (no io passed here, which is fine)
    await evaluateConnectionAchievements(meId, null);

    const me = await User.findById(meId);
    return res.json({ ok: true, user: me.toProfile() });
  } catch (err) {
    console.error("[Follow] followUser error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// DELETE /api/follow/:userId
const unfollowUser = async (req, res) => {
  try {
    const { userId: targetId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const meId = req.user._id.toString();

    await User.findByIdAndUpdate(meId, { $pull: { following: targetId } });
    await User.findByIdAndUpdate(targetId, { $pull: { followers: meId } });

    const me = await User.findById(meId);
    return res.json({ ok: true, user: me.toProfile() });
  } catch (err) {
    console.error("[Follow] unfollowUser error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// GET /api/follow/following  — list of users I follow
const getFollowingList = async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .select("following")
      .populate("following", "_id username displayName avatarUrl level country")
      .lean();
    if (!me) return res.status(404).json({ error: "User not found" });

    const following = (me.following || []).map((u) => ({
      id: u._id.toString(),
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username)}`,
      level: u.level || 1,
      country: u.country || "",
    }));

    return res.json({ following });
  } catch (err) {
    console.error("[Follow] getFollowingList error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// GET /api/follow/:userId/status
const followStatus = async (req, res) => {
  try {
    const { userId: targetId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const me = await User.findById(req.user._id).select("following").lean();
    if (!me) return res.status(404).json({ error: "User not found" });

    const isFollowing = (me.following || []).some((id) => id.toString() === targetId);
    return res.json({ isFollowing });
  } catch (err) {
    console.error("[Follow] followStatus error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { followUser, unfollowUser, followStatus, getFollowingList };
