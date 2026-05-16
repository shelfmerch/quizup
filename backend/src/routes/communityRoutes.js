const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getPosts, createPost, getStatus, likePost } = require("../controllers/communityController");
const uploadPostImage = require("../middleware/uploadPostImage");

const router = express.Router();

router.get("/:categoryId/posts", getPosts);
router.post("/:categoryId/posts", requireAuth, createPost);
router.get("/:categoryId/status", requireAuth, getStatus);
router.post("/post/:postId/like", requireAuth, likePost);

router.post("/upload-image", requireAuth, uploadPostImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });
  res.json({ imageUrl: req.file.location });
});

module.exports = router;
