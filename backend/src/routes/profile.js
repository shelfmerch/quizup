const express = require("express");
const router = express.Router();
const { getProfile, updateProfile, getMatchHistory, getFollowers, getAllProfiles } = require("../controllers/profileController");
const { requireAuth } = require("../middleware/auth");
const { uploadAvatar } = require("../controllers/profileUploadController");

// Static paths before `/:userId` so names like "avatar" are not captured as IDs.
router.patch("/", requireAuth, updateProfile);
router.put("/avatar", requireAuth, ...uploadAvatar);
router.get("/all", requireAuth, getAllProfiles);
router.get("/:userId/history", getMatchHistory);
router.get("/:userId/followers", getFollowers);
router.get("/:userId", getProfile);

module.exports = router;
