const express = require("express");
const router = express.Router();
const { getProfile, updateProfile, getMatchHistory } = require("../controllers/profileController");
const { requireAuth } = require("../middleware/auth");

router.get("/:userId/history", getMatchHistory);
router.get("/:userId", getProfile);
router.patch("/", requireAuth, updateProfile);

module.exports = router;
