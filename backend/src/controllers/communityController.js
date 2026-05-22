const CommunityPost = require("../models/CommunityPost");
const Match = require("../models/Match");

const getPosts = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const posts = await CommunityPost.find({ categoryId })
      .populate("authorId", "username avatarUrl displayName")
      .populate("comments.authorId", "username avatarUrl displayName")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ posts });
  } catch (err) {
    console.error("getPosts error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const createPost = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { content, imageUrl, videoUrl } = req.body;

    if ((!content || !content.trim()) && !imageUrl && !videoUrl) {
      return res.status(400).json({ error: "Content, image, or video is required" });
    }

    if (imageUrl && videoUrl) {
      return res.status(400).json({ error: "Post cannot include both an image and a video" });
    }

    const count = await Match.countDocuments({
      categoryId,
      $or: [{ "player1.userId": req.user._id }, { "player2.userId": req.user._id }],
      status: { $in: ["completed", "finalizing"] }
    });

    if (count < 25) {
      return res.status(403).json({ error: "You must play 25 matches in this category to post." });
    }

    const newPost = await CommunityPost.create({
      categoryId,
      authorId: req.user._id,
      content: (content || "").trim(),
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
    });

    const populatedPost = await CommunityPost.findById(newPost._id)
      .populate("authorId", "username avatarUrl displayName")
      .lean();

    res.status(201).json({ post: populatedPost });
  } catch (err) {
    console.error("createPost error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const getStatus = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const count = await Match.countDocuments({
      categoryId,
      $or: [{ "player1.userId": req.user._id }, { "player2.userId": req.user._id }],
      status: { $in: ["completed", "finalizing"] }
    });
    res.json({ playedMatches: count, communityUnlocked: count >= 25 });
  } catch (err) {
    console.error("getStatus error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await CommunityPost.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const liked = post.likes.some(id => id.toString() === req.user._id.toString());
    if (liked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);
    }
    await post.save();
    res.json({ success: true, likes: post.likes.length, liked: !liked });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

async function countCategoryMatches(userId, categoryId) {
  return Match.countDocuments({
    categoryId,
    $or: [{ "player1.userId": userId }, { "player2.userId": userId }],
    status: { $in: ["completed", "finalizing"] },
  });
}

const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: "Comment is required" });
    }

    const post = await CommunityPost.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const count = await countCategoryMatches(req.user._id, post.categoryId);
    if (count < 25) {
      return res.status(403).json({ error: "You must unlock the community to comment." });
    }

    post.comments.push({ authorId: req.user._id, text: text.trim().slice(0, 500) });
    await post.save();

    const updated = await CommunityPost.findById(postId)
      .populate("authorId", "username avatarUrl displayName")
      .populate("comments.authorId", "username avatarUrl displayName")
      .lean();

    res.status(201).json({ post: updated });
  } catch (err) {
    console.error("addComment error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getPosts, createPost, getStatus, likePost, addComment };
