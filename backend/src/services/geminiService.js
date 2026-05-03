const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Models are tried in order until one accepts generateContent.
 * Set GEMINI_MODEL to pin the first choice; add GEMINI_MODEL_FALLBACKS=comma,separated
 * (optional). Built-ins cover 404s when Google deprecates an id for your API version.
 */
const BUILTIN_MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

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
 * Wrong / retired model id for this API key or v1beta surface.
 * @param {unknown} e
 */
const isModelNotFound = (e) => {
  const s = String(e?.message || e || "");
  return (
    (s.includes("404") && (s.includes("not found") || s.includes("Not Found"))) ||
    s.includes("is not found for API version") ||
    s.includes("is not supported for generateContent")
  );
};

/** Free tier reports e.g. limit: 0 for unsupported models — skip retries. */
const isQuotaDisabledForModel = (e) => {
  const s = String(e?.message || e || "");
  return s.includes("limit: 0") && (s.includes("quota") || s.includes("Quota"));
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

const getModelCandidates = () => {
  const primary = (process.env.GEMINI_MODEL || "").trim();
  const extras = (process.env.GEMINI_MODEL_FALLBACKS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  if (primary) out.push(primary);
  for (const m of [...extras, ...BUILTIN_MODEL_FALLBACKS]) {
    if (m && !out.includes(m)) out.push(m);
  }
  if (out.length === 0) out.push(...BUILTIN_MODEL_FALLBACKS);
  return out;
};

let _client = null;

const getClient = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  if (!_client) _client = new GoogleGenerativeAI(key);
  return _client;
};

/**
 * @param {string} modelId
 * @param {{ temperature?: number, json?: boolean }} [opts]
 */
const getModel = (modelId, opts = {}) => {
  if (!modelId) throw new Error("Gemini modelId is required");
  const { temperature = 0.55, json = true } = opts;
  return getClient().getGenerativeModel({
    model: modelId,
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
  const candidates = getModelCandidates();
  const maxAttempts = getMaxAttempts();
  let lastErr;

  outer: for (const modelId of candidates) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const model = getModel(modelId, opts);
        const res = await model.generateContent(prompt);
        return res.response.text();
      } catch (e) {
        lastErr = e;
        if (isModelNotFound(e)) {
          console.warn(`[Gemini] model not available: ${modelId} — trying next candidate`);
          continue outer;
        }
        const idx = candidates.indexOf(modelId);
        if (isQuotaDisabledForModel(e) && idx >= 0 && idx < candidates.length - 1) {
          console.warn(`[Gemini] no quota on free tier for ${modelId} — trying next candidate`);
          continue outer;
        }
        const rateLimited = isRateLimitError(e);
        if (rateLimited && attempt < maxAttempts) {
          const fromApi = e?.message ? parseRetryDelayMs(e.message) : null;
          const exponential = Math.min(120_000, 4000 * 2 ** (attempt - 1));
          const waitMs = fromApi ?? exponential;
          console.warn(`[Gemini] rate limited ${modelId} (attempt ${attempt}/${maxAttempts}), waiting ${waitMs}ms`);
          await sleep(waitMs);
          continue;
        }
        if (rateLimited && attempt === maxAttempts && idx >= 0 && idx < candidates.length - 1) {
          console.warn(`[Gemini] still rate limited on ${modelId} — trying next model`);
          continue outer;
        }
        throw e;
      }
    }
  }

  throw lastErr || new Error("Gemini: no model candidates succeeded");
};

module.exports = {
  generateText,
  getModel,
  getModelCandidates,
};
