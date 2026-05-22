const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: { type: String, index: true, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderAvatar: { type: String, default: "" },
    text: { type: String, default: "", maxlength: 16384 },
    mediaUrl: { type: String, default: "" },
    mediaType: { type: String, default: "" }, // e.g. "image/jpeg", "video/mp4"
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

module.exports = mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatMessageSchema);
