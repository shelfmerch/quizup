const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { getUnreadSummary, markRead, getConversations } = require("../controllers/chatController");
const uploadChatMedia = require("../middleware/uploadChatMedia");

router.get("/unread-summary", requireAuth, getUnreadSummary);
router.get("/conversations", requireAuth, getConversations);
router.put("/read", requireAuth, markRead);

// Upload image/video for a chat message → returns permanent S3 URL
router.post("/upload-media", requireAuth, uploadChatMedia.single("media"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  res.json({
    mediaUrl: req.file.location,
    mediaType: req.file.mimetype,
  });
});

module.exports = router;
