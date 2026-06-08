const express = require("express");
const router = express.Router();
const { getChallenge } = require("../controllers/challengeController");
const { requireAuth } = require("../middleware/auth");

router.get("/:challengeId", requireAuth, getChallenge);

module.exports = router;
