const mongoose = require("mongoose");

const chatReadStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: String, required: true, index: true },
    lastReadAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

chatReadStateSchema.index({ userId: 1, roomId: 1 }, { unique: true });

module.exports = mongoose.models.ChatReadState || mongoose.model("ChatReadState", chatReadStateSchema);
