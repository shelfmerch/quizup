const express = require("express");
const router = express.Router();
const { getProfile, updateProfile, getMatchHistory } = require("../controllers/profileController");
const { requireAuth } = require("../middleware/auth");

router.get("/:userId/history", getMatchHistory);
router.get("/:userId", getProfile);
// Avatar upload + update
router.put("/avatar", requireAuth, require("../controllers/profileUploadController").uploadAvatar);
router.patch("/", requireAuth, updateProfile);

module.exports = router;
