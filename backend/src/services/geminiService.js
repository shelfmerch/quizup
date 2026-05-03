const { GoogleGenerativeAI } = require("@google/generative-ai");
const { runSerialized } = require("./aiRequestGate");

/**
 * Order: try full Flash before Flash-Lite (often separate RPM buckets on free tier).
 * Override with GEMINI_MODEL / GEMINI_MODEL_FALLBACKS.
 */
const BUILTIN_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cooldownUntil = new Map();

const markModelCooldown = (modelId, ms) => {
  cooldownUntil.set(modelId, Date.now() + ms);
};

const getCooledCandidates = () => {
  const now = Date.now();
  return getModelCandidates().filter((id) => (cooldownUntil.get(id) || 0) <= now);
};

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

const isModelNotFound = (e) => {
  const s = String(e?.message || e || "");
  return (
    (s.includes("404") && (s.includes("not found") || s.includes("Not Found"))) ||
    s.includes("is not found for API version") ||
    s.includes("is not supported for generateContent")
  );
};

const isQuotaDisabledForModel = (e) => {
  const s = String(e?.message || e || "");
  return s.includes("limit: 0") && (s.includes("quota") || s.includes("Quota"));
};

const parseRetryDelayMs = (message) => {
  const m = String(message).match(/retry in ([\d.]+)\s*s/i);
  if (!m) return null;
  const sec = parseFloat(m[1]);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.ceil(sec * 1000) + 1500;
};

const getSameModelRateRetries = () => {
  const n = Number(process.env.GEMINI_SAME_MODEL_RATE_RETRIES);
  return Number.isFinite(n) && n >= 1 ? Math.min(8, n) : 3;
};

const getMaxWaves = () => {
  const n = Number(process.env.GEMINI_MAX_WAVES);
  return Number.isFinite(n) && n >= 1 ? Math.min(10, n) : 5;
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
 * Exponential backoff for same-model retries (cap in env).
 * @param {number} attempt 1-based
 */
const backoffMsForAttempt = (attempt, message) => {
  const fromApi = message ? parseRetryDelayMs(message) : null;
  const cap = Number(process.env.GEMINI_MAX_BACKOFF_MS);
  const maxB = Number.isFinite(cap) && cap > 5000 ? cap : 60_000;
  const base = Number(process.env.GEMINI_BACKOFF_BASE_MS);
  const b = Number.isFinite(base) && base > 500 ? base : 2000;
  const exponential = Math.min(maxB, b * 2 ** (attempt - 1));
  return fromApi != null ? Math.min(maxB, fromApi) : exponential;
};

/**
 * Internal Gemini call (no global serialization — use generateText()).
 * @param {string} prompt
 * @param {{ temperature?: number, json?: boolean }} [opts]
 */
const generateTextInternal = async (prompt, opts = {}) => {
  const sameModelRetries = getSameModelRateRetries();
  const maxWaves = getMaxWaves();
  const cooldownMs = Number(process.env.GEMINI_MODEL_COOLDOWN_MS);
  const modelCooldown = Number.isFinite(cooldownMs) && cooldownMs > 0 ? cooldownMs : 120_000;

  let lastErr = new Error("Gemini: no response");

  for (let wave = 0; wave < maxWaves; wave += 1) {
    const candidates = getCooledCandidates();
    if (candidates.length === 0) {
      const waitAll = Math.min(180_000, parseRetryDelayMs(String(lastErr?.message || "")) || 45_000);
      console.warn(`[Gemini] all models in cooldown — sleeping ${waitAll}ms`);
      await sleep(waitAll);
      continue;
    }

    if (wave > 0) {
      const inter = parseRetryDelayMs(String(lastErr?.message || "")) ?? Math.min(120_000, 30_000 * wave);
      console.warn(`[Gemini] wave ${wave + 1}/${maxWaves}, cooling ${inter}ms`);
      await sleep(inter);
    }

    modelLoop: for (let mi = 0; mi < candidates.length; mi += 1) {
      const modelId = candidates[mi];
      const idx = mi;

      for (let attempt = 1; attempt <= sameModelRetries; attempt += 1) {
        try {
          const model = getModel(modelId, opts);
          const res = await model.generateContent(prompt);
          return res.response.text();
        } catch (e) {
          lastErr = e;
          if (isModelNotFound(e)) {
            console.warn(`[Gemini] model not available: ${modelId} — next`);
            continue modelLoop;
          }
          if (isQuotaDisabledForModel(e) && idx < candidates.length - 1) {
            console.warn(`[Gemini] no free-tier quota for ${modelId} — next`);
            continue modelLoop;
          }
          const rateLimited = isRateLimitError(e);
          if (!rateLimited) {
            throw e;
          }

          if (attempt < sameModelRetries) {
            const waitMs = backoffMsForAttempt(attempt, e.message);
            console.warn(`[Gemini] rate limited ${modelId} (${attempt}/${sameModelRetries}), backoff ${waitMs}ms`);
            await sleep(waitMs);
            continue;
          }

          markModelCooldown(modelId, modelCooldown);
          if (idx < candidates.length - 1) {
            console.warn(`[Gemini] rate limited ${modelId} — switching model`);
            await sleep(Number(process.env.GEMINI_MODEL_SWITCH_GAP_MS) || 2000);
            continue modelLoop;
          }

          console.warn(`[Gemini] rate limited on last model ${modelId} — end wave`);
          break modelLoop;
        }
      }
    }
  }

  throw lastErr;
};

/**
 * Rate-limited, strictly serialized Gemini generateContent (one in flight globally).
 * @param {string} prompt
 * @param {{ temperature?: number, json?: boolean }} [opts]
 * @returns {Promise<string>}
 */
const generateText = async (prompt, opts = {}) => {
  return runSerialized(() => generateTextInternal(prompt, opts));
};

module.exports = {
  generateText,
  getModel,
  getModelCandidates,
};
