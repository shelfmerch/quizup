const mongoose = require("mongoose");

const playerAnswerSchema = new mongoose.Schema(
  {
    questionId: String,
    selectedIndex: { type: Number, default: null }, // null = timeout / no answer
    isCorrect: { type: Boolean, default: false },
    timeMs: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
  },
  { _id: false }
);

const matchPlayerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: String,
    avatarUrl: String,
    socketId: { type: String, default: null }, 
    score: { type: Number, default: 0 },
    answers: [playerAnswerSchema],
    level: { type: Number, default: 1 },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    categoryId: { type: String, required: true },
    categoryName: { type: String, required: true },
    player1: { type: matchPlayerSchema, required: true },
    player2: { type: matchPlayerSchema, required: true },
    status: {
      type: String,
      enum: ["waiting", "in_progress", "completed", "abandoned", "finalizing"],
      default: "waiting",
    },
    // Rapid-fire socket state storage:
    connectedPlayers: [{ type: String }],
    timerEndsAt: { type: Date, default: null },
    questions: { type: mongoose.Schema.Types.Mixed, default: [] }, 
    currentQuestionIndex: { type: Number, default: -1 },
    roundAnswers: { type: mongoose.Schema.Types.Mixed, default: {} },
    // End rapid-fire state
    currentRound: { type: Number, default: 0 },
    totalRounds: { type: Number, default: 7 },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for fast history lookups per user
matchSchema.index({ "player1.userId": 1, createdAt: -1 });
matchSchema.index({ "player2.userId": 1, createdAt: -1 });

module.exports = mongoose.model("Match", matchSchema);
