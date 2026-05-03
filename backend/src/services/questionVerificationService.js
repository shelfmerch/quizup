const { generateText } = require("./geminiService");
const { parseJsonLoose } = require("../utils/questionParsing");

/**
 * Second-pass verification for factual MCQ items.
 * @param {{ stem: string, options: string[], correctIndex: number, categoryName: string }} q
 * @returns {Promise<{ ok: boolean, confidence: number, reason?: string }>}
 */
const verifyQuestion = async ({ stem, options, correctIndex, categoryName }) => {
  const correct = options[correctIndex];
  const prompt = `You are a strict fact-checker for trivia.

Topic: "${categoryName}"
Question: ${JSON.stringify(stem)}
Options: ${JSON.stringify(options)}
Proposed correct answer (full string): ${JSON.stringify(correct)}

Tasks:
1) Decide if the proposed correct answer is unambiguously true and best among the options.
2) Rate your confidence from 0 to 1 (1 = certain).

Return ONLY JSON: {"ok":boolean,"confidence":number,"reason":string}`;

  const raw = await generateText(prompt, { temperature: 0.2, json: true });
  const out = parseJsonLoose(raw);
  const ok = Boolean(out.ok);
  const confidence = typeof out.confidence === "number" ? Math.max(0, Math.min(1, out.confidence)) : 0;
  const reason = typeof out.reason === "string" ? out.reason : "";
  return { ok, confidence, reason };
};

module.exports = {
  verifyQuestion,
};
