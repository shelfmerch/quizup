const express = require("express");
const router = express.Router();
const { getGlobalLeaderboard, getCategoryLeaderboard } = require("../controllers/leaderboardController");

router.get("/", getGlobalLeaderboard);
router.get("/:categoryId", getCategoryLeaderboard);

module.exports = router;
