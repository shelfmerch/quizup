const { GoogleGenerativeAI } = require("@google/generative-ai");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

let _client = null;

const getClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  if (!_client) _client = new GoogleGenerativeAI(key);
  return _client;
};

/**
 * @param {{ temperature?: number, json?: boolean }} [opts]
 */
const getModel = (opts = {}) => {
  const { temperature = 0.55, json = true } = opts;
  return getClient().getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  });
};

/**
 * @param {string} prompt
 * @param {{ temperature?: number, json?: boolean }} [opts]
 * @returns {Promise<string>}
 */
const generateText = async (prompt, opts = {}) => {
  const model = getModel(opts);
  const res = await model.generateContent(prompt);
  return res.response.text();
};

module.exports = {
  generateText,
  getModel,
  DEFAULT_MODEL,
};
