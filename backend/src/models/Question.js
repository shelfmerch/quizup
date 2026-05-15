const mongoose = require("mongoose");
const { normalizeQuestionText } = require("../utils/questionParsing");

const questionSchema = new mongoose.Schema(
  {
    categoryId: { type: String, required: true, index: true }, // slug string, not ObjectId
    text: { type: String, required: true, maxlength: 500 },
    /** Normalized stem for dedupe (lowercase, collapsed spaces). */
    textNorm: { type: String, default: "", index: true },
    imageUrl: { type: String, default: null },
    /** IMAGE = visual-first (expects imageUrl); TEXT = text-only stem. */
    questionType: {
      type: String,
      enum: ["IMAGE", "TEXT"],
      default: "TEXT",
      index: true,
    },
    /** Short key for "same concept" dedupe within a match (e.g. "golden-gate-bridge"). */
    conceptKey: { type: String, default: "", index: true },
    /** Search hint used when resolving stock images (not shown to players). */
    imageQuery: { type: String, default: "" },
    options: {
      type: [String],
      validate: [(v) => v.length === 4, "Questions must have exactly 4 options"],
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    difficulty: { type: Number, default: 5, min: 1, max: 10, index: true },
    timeLimit: { type: Number, default: 10 }, // seconds
    isActive: { type: Boolean, default: true },
    source: { type: String, enum: ["AI", "MANUAL"], default: "MANUAL" },
    verified: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

questionSchema.index({ categoryId: 1, text: 1 });
questionSchema.index({ categoryId: 1, textNorm: 1 }, { unique: false });

questionSchema.pre("save", function (next) {
  this.textNorm = normalizeQuestionText(this.text);
  next();
});

// Automatically update the Category questionCount when a Question is saved or removed
async function updateCategoryCount(categoryId, model) {
  if (!categoryId) return;
  const count = await model.countDocuments({ categoryId, isActive: true });
  const Category = mongoose.model("Category");
  if (Category) {
    await Category.findOneAndUpdate({ slug: categoryId }, { questionCount: count });
  }
}

questionSchema.post("save", async function (doc) {
  await updateCategoryCount(doc.categoryId, this.constructor);
});

questionSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await updateCategoryCount(doc.categoryId, doc.constructor);
  }
});

questionSchema.post("deleteOne", { document: true, query: false }, async function (doc) {
  if (doc) {
    await updateCategoryCount(doc.categoryId, doc.constructor);
  }
});

questionSchema.post("insertMany", async function (docs) {
  if (Array.isArray(docs) && docs.length > 0) {
    const categories = [...new Set(docs.map((d) => d.categoryId))];
    for (const cat of categories) {
      await updateCategoryCount(cat, this);
    }
  }
});

module.exports = mongoose.model("Question", questionSchema);
