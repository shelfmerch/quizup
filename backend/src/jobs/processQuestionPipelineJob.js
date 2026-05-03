const Category = require("../models/Category");
const Question = require("../models/Question");
const { generateQuestionBatch } = require("../services/questionGeneratorService");
const { verifyQuestion } = require("../services/questionVerificationService");
const { tagQuestion } = require("../services/questionTaggingService");
const { validateDraftStructure, isDuplicateInCategory, MIN_CONFIDENCE } = require("../utils/questionStructure");
const { normalizeQuestionText } = require("../utils/questionParsing");
const { resolveImageUrl } = require("../utils/imageResolver");
const { syncQuestionCount } = require("../services/categoryQuestionCount");

/**
 * @param {{ categoryId: string, batchSize: number }} data
 */
const processQuestionPipelineJob = async (data) => {
  const categoryId = String(data.categoryId || "").trim().toLowerCase();
  const batchSize = Math.min(20, Math.max(1, Math.floor(Number(data.batchSize) || 10)));

  const cat = await Category.findOne({ slug: categoryId }).lean();
  if (!cat) {
    throw new Error(`Category not found: ${categoryId}`);
  }

  const rawList = await generateQuestionBatch({
    categoryName: cat.name,
    categoryId,
    count: batchSize,
  });

  const saved = [];
  const rejected = [];

  for (const raw of rawList) {
    const struct = validateDraftStructure(raw);
    if (!struct.ok) {
      rejected.push({ reason: `structure:${struct.reason}` });
      continue;
    }
    const { text, options, correctIndex, questionType, imageQuery } = struct.normalized;

    if (await isDuplicateInCategory(Question, categoryId, text)) {
      rejected.push({ reason: "duplicate_question" });
      continue;
    }

    let verification;
    try {
      verification = await verifyQuestion({
        stem: text,
        options,
        correctIndex,
        categoryName: cat.name,
      });
    } catch (e) {
      rejected.push({ reason: `verify_error:${e.message}` });
      continue;
    }

    if (!verification.ok || verification.confidence < MIN_CONFIDENCE) {
      rejected.push({
        reason: "low_confidence_or_invalid",
        confidence: verification.confidence,
        detail: verification.reason,
      });
      continue;
    }

    let tags;
    let difficulty;
    let conceptKey;
    try {
      const tagged = await tagQuestion({ stem: text, options, categoryName: cat.name });
      tags = tagged.tags;
      difficulty = tagged.difficulty;
      conceptKey = tagged.conceptKey;
    } catch (e) {
      rejected.push({ reason: `tag_error:${e.message}` });
      continue;
    }

    let imageUrl = null;
    if (questionType === "IMAGE") {
      try {
        imageUrl = await resolveImageUrl({
          imageQuery,
          tags,
          questionType,
        });
      } catch {
        imageUrl = null;
      }
    }

    if (questionType === "IMAGE" && !imageUrl) {
      rejected.push({ reason: "image_resolve_failed" });
      continue;
    }

    try {
      const doc = await Question.create({
        categoryId,
        text,
        textNorm: normalizeQuestionText(text),
        imageUrl,
        questionType,
        conceptKey,
        imageQuery: imageQuery || "",
        options,
        correctIndex,
        difficulty,
        timeLimit: 10,
        isActive: true,
        source: "AI",
        verified: true,
        tags,
      });
      saved.push(doc._id.toString());
    } catch (e) {
      if (e && e.code === 11000) {
        rejected.push({ reason: "duplicate_key" });
        continue;
      }
      rejected.push({ reason: `db_error:${e.message}` });
    }
  }

  await syncQuestionCount(categoryId);

  return { saved: saved.length, rejected: rejected.length, rejectedDetails: rejected };
};

module.exports = {
  processQuestionPipelineJob,
};
