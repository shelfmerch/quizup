const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    achievementId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "🏆" },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

achievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model("Achievement", achievementSchema);
