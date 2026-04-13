const Match = require("../models/Match");
const mongoose = require("mongoose");

// GET /api/matches/:matchId
const getMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ error: "Invalid match ID" });
    }

    const match = await Match.findById(matchId).lean();
    if (!match) return res.status(404).json({ error: "Match not found" });

    return res.json({ match });
  } catch (err) {
    console.error("[Match] getMatch error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getMatch };
