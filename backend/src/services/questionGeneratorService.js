const { generateText } = require("./geminiService");
const { parseJsonLoose } = require("../utils/questionParsing");

/**
 * Ask Gemini for a batch of multiple-choice questions.
 * @param {{ categoryName: string, categoryId: string, count: number }} params
 * @returns {Promise<unknown[]>} raw question objects from model
 */
const generateQuestionBatch = async ({ categoryName, categoryId, count }) => {
  const n = Math.min(20, Math.max(1, Math.floor(Number(count) || 0)));
  const imageCount = Math.round(n * 0.6);
  const textCount = n - imageCount;

  const prompt = `You are an expert quiz writer for a mobile trivia app.
Topic name: "${categoryName}" (internal id: ${categoryId}).

Generate exactly ${n} distinct multiple-choice questions for this topic.
Distribution: exactly ${imageCount} with type "IMAGE" and exactly ${textCount} with type "TEXT".

Rules:
- Each question must be unique, fact-based, and appropriate for a general audience.
- Exactly 4 options per question, all non-empty strings, mutually distinct.
- "correctAnswer" must exactly equal one of the four options (verbatim string match).
- For type "IMAGE": include "imageQuery" — a short English search phrase for a stock photo (no proper nouns unless essential). For logos/brands include a real company DOMAIN in imageQuery like "spotify.com" so a logo API can be used.
- For type "TEXT": omit imageQuery or set it to "".
- difficulty in output is optional (will be refined later) — you may omit.

Return ONLY valid JSON with this exact shape:
{"questions":[{"question":string,"options":[string,string,string,string],"correctAnswer":string,"type":"IMAGE"|"TEXT","imageQuery"?:string}]}

No markdown, no commentary.`;

  const raw = await generateText(prompt, { temperature: 0.75, json: true });
  const parsed = parseJsonLoose(raw);
  const arr = parsed?.questions;
  if (!Array.isArray(arr)) throw new Error("Gemini response missing questions[]");
  return arr;
};

module.exports = {
  generateQuestionBatch,
};
