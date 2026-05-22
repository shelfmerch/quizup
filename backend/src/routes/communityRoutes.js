const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getPosts, createPost, getStatus, likePost, addComment } = require("../controllers/communityController");
const { uploadCommunityImage } = require("../controllers/communityUploadController");

const router = express.Router();

// Static paths before :categoryId to avoid accidental param capture
router.post("/upload-image", requireAuth, uploadCommunityImage);

router.get("/:categoryId/posts", getPosts);
router.post("/:categoryId/posts", requireAuth, createPost);
router.get("/:categoryId/status", requireAuth, getStatus);
router.post("/post/:postId/like", requireAuth, likePost);
router.post("/post/:postId/comments", requireAuth, addComment);

module.exports = router;
