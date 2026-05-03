const Category = require("../models/Category");
const Question = require("../models/Question");
const { generateQuestionBatch } = require("../services/questionGeneratorService");
const { verifyQuestion } = require("../services/questionVerificationService");
const { tagQuestion } = require("../services/questionTaggingService");
const { validateDraftStructure, isDuplicateInCategory, MIN_CONFIDENCE: DEFAULT_MIN_CONF } = require("../utils/questionStructure");

const getVerifyMinConfidence = () => {
  const n = Number(process.env.MIN_QUESTION_VERIFY_CONFIDENCE);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_MIN_CONF;
};
const { normalizeQuestionText } = require("../utils/questionParsing");
const { resolveImageUrl } = require("../utils/imageResolver");
const { syncQuestionCount } = require("../services/categoryQuestionCount");
const { BATCH_SIZE: PIPELINE_BATCH_CAP } = require("../queue/questionPipelineQueue");

/**
 * @param {{ categoryId: string, batchSize: number }} data
 */
const processQuestionPipelineJob = async (data) => {
  const categoryId = String(data.categoryId || "").trim().toLowerCase();
  const batchSize = Math.min(PIPELINE_BATCH_CAP, Math.max(1, Math.floor(Number(data.batchSize) || PIPELINE_BATCH_CAP)));

  const cat = await Category.findOne({ slug: categoryId }).lean();
  if (!cat) {
    throw new Error(`Category not found: ${categoryId}`);
  }

  const rawList = await generateQuestionBatch({
    categoryName: cat.name,
    categoryId,
    count: batchSize,
  });

  const minConf = getVerifyMinConfidence();
  console.log(
    `[QuestionPipeline] start categoryId=${categoryId} batchSize=${batchSize} rawCount=${rawList?.length ?? 0} verifyMinConfidence=${minConf}`
  );

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

    if (!verification.ok || verification.confidence < minConf) {
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
    let persistType = questionType;
    let persistImageQuery = imageQuery || "";
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
      console.warn(
        `[QuestionPipeline] no imageUrl (check PEXELS_API_KEY / UNSPLASH_ACCESS_KEY) — saving as TEXT: "${String(text).slice(0, 60)}..."`
      );
      persistType = "TEXT";
      persistImageQuery = "";
      imageUrl = null;
    }

    try {
      const doc = await Question.create({
        categoryId,
        text,
        textNorm: normalizeQuestionText(text),
        imageUrl,
        questionType: persistType,
        conceptKey,
        imageQuery: persistImageQuery,
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

  const summary = {
    saved: saved.length,
    rejected: rejected.length,
    rejectedDetails: rejected,
  };
  const byReason = {};
  for (const r of rejected) {
    const key = String(r.reason || "unknown").split(":")[0];
    byReason[key] = (byReason[key] || 0) + 1;
  }
  console.log(`[QuestionPipeline] done categoryId=${categoryId}`, summary.saved, "saved,", summary.rejected, "rejected", byReason);

  return summary;
};

module.exports = {
  processQuestionPipelineJob,
};
