const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { getUnreadSummary, markRead } = require("../controllers/chatController");

router.get("/unread-summary", requireAuth, getUnreadSummary);
router.put("/read", requireAuth, markRead);

module.exports = router;
