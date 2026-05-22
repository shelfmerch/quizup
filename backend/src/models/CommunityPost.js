const mongoose = require("mongoose");

const communityPostSchema = new mongoose.Schema(
  {
    categoryId: { type: String, required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "", maxlength: 1000 },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommunityPost", communityPostSchema);
