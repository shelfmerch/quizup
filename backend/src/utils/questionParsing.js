/**
 * @param {unknown} raw
 * @returns {string}
 */
const normalizeQuestionText = (raw) => {
  if (raw == null) return "";
  return String(raw)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s?.!,'"-]/gi, "")
    .trim();
};

/**
 * @param {string} text
 * @returns {string}
 */
const slugifyConcept = (text) => {
  const s = String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 80) || "concept";
};

/**
 * Safely parse JSON from Gemini (strip markdown fences).
 * @param {string} text
 * @returns {unknown}
 */
const parseJsonLoose = (text) => {
  let t = String(text || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return JSON.parse(t);
};

module.exports = {
  normalizeQuestionText,
  slugifyConcept,
  parseJsonLoose,
};
