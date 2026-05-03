const { normalizeQuestionText } = require("./questionParsing");

const MIN_CONFIDENCE = 0.7;

/**
 * @param {import("mongoose").Model} QuestionModel
 * @param {string} categoryId
 * @param {string} text
 */
const isDuplicateInCategory = async (QuestionModel, categoryId, text) => {
  const textNorm = normalizeQuestionText(text);
  if (!textNorm) return false;
  const hit = await QuestionModel.exists({ categoryId, textNorm });
  if (hit) return true;
  // Legacy rows without textNorm: check normalized text in-memory for this category (bounded).
  const legacy = await QuestionModel.find({ categoryId, isActive: true, textNorm: "" })
    .select("text")
    .limit(2000)
    .lean();
  return legacy.some((d) => normalizeQuestionText(d.text) === textNorm);
};

/**
 * @typedef {Object} DraftQuestion
 * @property {string} question
 * @property {string[]} options
 * @property {string} correctAnswer
 * @property {"IMAGE"|"TEXT"} type
 * @property {string} [imageQuery]
 */

/**
 * @param {unknown} q
 * @returns {{ ok: boolean, reason?: string, normalized?: { text: string, options: string[], correctIndex: number, questionType: "IMAGE"|"TEXT", imageQuery?: string } }}
 */
const validateDraftStructure = (q) => {
  if (!q || typeof q !== "object") return { ok: false, reason: "not_an_object" };
  const question = typeof q.question === "string" ? q.question.trim() : "";
  if (!question || question.length > 500) return { ok: false, reason: "bad_question_text" };

  const opts = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
  if (opts.length !== 4) return { ok: false, reason: "options_not_four" };
  if (opts.some((o) => !o)) return { ok: false, reason: "empty_option" };

  const correctAnswer = typeof q.correctAnswer === "string" ? q.correctAnswer.trim() : "";
  if (!correctAnswer) return { ok: false, reason: "missing_correct_answer" };

  let correctIndex = opts.findIndex((o) => o === correctAnswer);
  if (correctIndex < 0) {
    const ci = opts.findIndex((o) => o.toLowerCase() === correctAnswer.toLowerCase());
    if (ci < 0) return { ok: false, reason: "answer_not_in_options" };
    correctIndex = ci;
  }

  const typeRaw = typeof q.type === "string" ? q.type.trim().toUpperCase() : "";
  const t = typeRaw === "IMAGE" || typeRaw === "TEXT" ? typeRaw : null;
  if (!t) return { ok: false, reason: "invalid_type" };

  const imageQuery =
    typeof q.imageQuery === "string" && q.imageQuery.trim() ? q.imageQuery.trim().slice(0, 120) : undefined;
  if (t === "IMAGE" && !imageQuery) return { ok: false, reason: "image_type_needs_imageQuery" };

  return {
    ok: true,
    normalized: {
      text: question,
      options: opts,
      correctIndex,
      questionType: t,
      imageQuery,
    },
  };
};

module.exports = {
  validateDraftStructure,
  isDuplicateInCategory,
  MIN_CONFIDENCE,
};
