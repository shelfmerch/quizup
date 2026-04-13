const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    categoryId: { type: String, required: true, index: true }, // slug string, not ObjectId
    text: { type: String, required: true, maxlength: 500 },
    imageUrl: { type: String, default: null },
    options: {
      type: [String],
      validate: [(v) => v.length === 4, "Questions must have exactly 4 options"],
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    timeLimit: { type: Number, default: 10 }, // seconds
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
