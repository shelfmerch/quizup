const { slugifyConcept } = require("../utils/questionParsing");

const QUESTIONS_PER_MATCH = 7;
const MIN_IMAGE = 3;
const MAX_TEXT = 4;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * @param {object} q lean question
 * @returns {"IMAGE"|"TEXT"}
 */
const inferQuestionType = (q) => {
  if (q.questionType === "IMAGE" || q.questionType === "TEXT") return q.questionType;
  if (q.imageUrl) return "IMAGE";
  return "TEXT";
};

const conceptOf = (q) => {
  const ck = (q.conceptKey && String(q.conceptKey).trim()) || "";
  if (ck) return ck;
  return slugifyConcept(q.text || "");
};

/**
 * @param {object[]} ordered length 7
 */
const validateMatchSet = (ordered) => {
  if (!Array.isArray(ordered) || ordered.length !== QUESTIONS_PER_MATCH) return false;
  const ids = ordered.map((q) => q._id.toString());
  if (new Set(ids).size !== QUESTIONS_PER_MATCH) return false;

  const concepts = ordered.map(conceptOf);
  if (new Set(concepts).size !== QUESTIONS_PER_MATCH) return false;

  let imageCount = 0;
  for (const q of ordered) {
    if (inferQuestionType(q) === "IMAGE") imageCount += 1;
  }
  if (imageCount < MIN_IMAGE) return false;
  if (ordered.length - imageCount > MAX_TEXT) return false;

  const bonus = ordered[QUESTIONS_PER_MATCH - 1];
  const others = ordered.slice(0, QUESTIONS_PER_MATCH - 1);
  const bonusD = Number(bonus.difficulty) || 5;
  const maxOther = Math.max(...others.map((q) => Number(q.difficulty) || 5));
  if (bonusD < maxOther) return false;

  return true;
};

/**
 * Pick Q7: max difficulty, tie-break toward IMAGE.
 * @param {object[]} pool
 */
const pickBonusQuestion = (pool) => {
  if (!pool.length) return null;
  let best = pool[0];
  let bestD = Number(best.difficulty) || 5;
  let bestImg = inferQuestionType(best) === "IMAGE" ? 1 : 0;

  for (let i = 1; i < pool.length; i++) {
    const q = pool[i];
    const d = Number(q.difficulty) || 5;
    const img = inferQuestionType(q) === "IMAGE" ? 1 : 0;
    if (d > bestD || (d === bestD && img > bestImg)) {
      best = q;
      bestD = d;
      bestImg = img;
    }
  }
  return best;
};

/**
 * @param {object[]} allQuestions lean from Mongo
 * @param {Set<string>} [excludeQuestionIds]
 * @returns {object[]} ordered 7 questions for the match
 */
const selectQuestionsForMatch = (allQuestions, excludeQuestionIds = null) => {
  let pool = [...allQuestions];
  if (excludeQuestionIds && excludeQuestionIds.size) {
    const filtered = pool.filter((q) => !excludeQuestionIds.has(q._id.toString()));
    if (filtered.length >= QUESTIONS_PER_MATCH) pool = filtered;
  }

  if (pool.length < QUESTIONS_PER_MATCH) {
    shuffleInPlace(pool);
    return pool.slice(0, Math.min(QUESTIONS_PER_MATCH, pool.length));
  }

  const bonus = pickBonusQuestion(pool);
  const rest = pool.filter((q) => q._id.toString() !== bonus._id.toString());

  for (let attempt = 0; attempt < 400; attempt++) {
    shuffleInPlace(rest);
    const six = rest.slice(0, QUESTIONS_PER_MATCH - 1);
    const ordered = [...six, bonus];
    if (validateMatchSet(ordered)) return ordered;
  }

  // Relaxed: still enforce image min / text max / unique ids & concepts; relax bonus difficulty rule
  for (let attempt = 0; attempt < 200; attempt++) {
    shuffleInPlace(rest);
    const six = rest.slice(0, QUESTIONS_PER_MATCH - 1);
    const ordered = [...six, bonus];
    if (ordered.length !== QUESTIONS_PER_MATCH) continue;
    const ids = ordered.map((q) => q._id.toString());
    if (new Set(ids).size !== QUESTIONS_PER_MATCH) continue;
    const concepts = ordered.map(conceptOf);
    if (new Set(concepts).size !== QUESTIONS_PER_MATCH) continue;
    let imageCount = 0;
    for (const q of ordered) {
      if (inferQuestionType(q) === "IMAGE") imageCount += 1;
    }
    if (imageCount < MIN_IMAGE) continue;
    if (ordered.length - imageCount > MAX_TEXT) continue;
    return ordered;
  }

  // Last resort: legacy random 7 (may violate strict bonus / mix if pool is shallow)
  console.warn("[matchQuestionSelection] Falling back to random slice — tighten pool or constraints.");
  shuffleInPlace(pool);
  return pool.slice(0, QUESTIONS_PER_MATCH);
};

/**
 * @param {object} q
 * @param {number} index
 * @param {number} total
 */
const mapQuestionForMatch = (q, index, total) => ({
  id: q._id.toString(),
  categoryId: q.categoryId,
  text: q.text,
  imageUrl: q.imageUrl || null,
  questionType: inferQuestionType(q),
  difficulty: Number(q.difficulty) || 5,
  conceptKey: conceptOf(q),
  options: q.options,
  correctIndex: q.correctIndex,
  timeLimit: q.timeLimit,
  isBonusRound: index === total - 1,
  pointsMultiplier: index === total - 1 ? 2 : 1,
});

module.exports = {
  QUESTIONS_PER_MATCH,
  selectQuestionsForMatch,
  mapQuestionForMatch,
  inferQuestionType,
};
