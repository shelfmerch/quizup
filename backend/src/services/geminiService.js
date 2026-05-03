const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Default avoids gemini-2.0-flash on keys where Google reports free-tier limit 0 for that model.
 * Override with GEMINI_MODEL=gemini-2.0-flash (or another id) when billing / quota allows.
 */
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {unknown} e
 */
const isRateLimitError = (e) => {
  const s = String(e?.message || e || "");
  return (
    s.includes("429") ||
    s.includes("Too Many Requests") ||
    s.includes("RESOURCE_EXHAUSTED") ||
    s.includes("quota") ||
    s.includes("Quota exceeded")
  );
};

/**
 * Parse "Please retry in 54.44s" from Google error text.
 * @param {string} message
 */
const parseRetryDelayMs = (message) => {
  const m = String(message).match(/retry in ([\d.]+)\s*s/i);
  if (!m) return null;
  const sec = parseFloat(m[1]);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.ceil(sec * 1000) + 1500;
};

const getMaxAttempts = () => {
  const n = Number(process.env.GEMINI_MAX_RETRIES);
  return Number.isFinite(n) && n >= 1 ? Math.min(12, n) : 6;
};

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
  const maxAttempts = getMaxAttempts();
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const model = getModel(opts);
      const res = await model.generateContent(prompt);
      return res.response.text();
    } catch (e) {
      lastErr = e;
      const rateLimited = isRateLimitError(e);
      if (!rateLimited || attempt === maxAttempts) {
        throw e;
      }
      const fromApi = e?.message ? parseRetryDelayMs(e.message) : null;
      const exponential = Math.min(120_000, 4000 * 2 ** (attempt - 1));
      const waitMs = fromApi ?? exponential;
      console.warn(`[Gemini] rate limited (attempt ${attempt}/${maxAttempts}), waiting ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
};

module.exports = {
  generateText,
  getModel,
  DEFAULT_MODEL,
};
