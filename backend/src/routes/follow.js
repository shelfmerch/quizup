const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { followUser, unfollowUser, followStatus, getFollowingList } = require("../controllers/followController");

router.get("/following", requireAuth, getFollowingList);

router.get("/:userId/status", requireAuth, followStatus);
router.post("/:userId", requireAuth, followUser);
router.delete("/:userId", requireAuth, unfollowUser);

module.exports = router;
