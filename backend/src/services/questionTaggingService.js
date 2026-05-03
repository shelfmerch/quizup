const { generateText } = require("./geminiService");
const { parseJsonLoose } = require("../utils/questionParsing");

/**
 * Assign taxonomy tags, difficulty 1–10, and a stable conceptKey for dedupe.
 * @param {{ stem: string, options: string[], categoryName: string }} q
 */
const tagQuestion = async ({ stem, options, categoryName }) => {
  const prompt = `You label trivia questions for search and matchmaking.

Topic: "${categoryName}"
Question: ${JSON.stringify(stem)}
Options: ${JSON.stringify(options)}

Return ONLY JSON:
{
  "tags": string[],  // 2-6 short lowercase tokens like "flags","europe","animals","logos"
  "difficulty": number, // integer 1-10 (10 hardest)
  "conceptKey": string // kebab-case single topic id for this question's fact, max 60 chars, ascii
}`;

  const raw = await generateText(prompt, { temperature: 0.35, json: true });
  const out = parseJsonLoose(raw);
  let tags = Array.isArray(out.tags) ? out.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [];
  tags = [...new Set(tags)].slice(0, 8);

  let difficulty = Number(out.difficulty);
  if (!Number.isFinite(difficulty)) difficulty = 5;
  difficulty = Math.min(10, Math.max(1, Math.round(difficulty)));

  let conceptKey = typeof out.conceptKey === "string" ? out.conceptKey.trim().toLowerCase() : "";
  conceptKey = conceptKey.replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!conceptKey) {
    conceptKey = stem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "concept";
  }
  conceptKey = conceptKey.slice(0, 80);

  return { tags, difficulty, conceptKey };
};

module.exports = {
  tagQuestion,
};
