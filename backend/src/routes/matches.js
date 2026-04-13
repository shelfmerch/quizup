const express = require("express");
const router = express.Router();
const { getMatch } = require("../controllers/matchController");
const { requireAuth } = require("../middleware/auth");

router.get("/:matchId", requireAuth, getMatch);

module.exports = router;
