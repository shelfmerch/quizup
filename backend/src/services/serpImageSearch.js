/**
 * SerpAPI Google Images search for auto-filling question imageUrl.
 * Set SERP_API_KEY on the server — see https://serpapi.com/
 */
const https = require("https");

const STOP = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "which",
  "what",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "with",
  "from",
  "for",
  "and",
  "or",
  "but",
  "not",
  "often",
  "only",
  "into",
  "per",
  "raw",
  "eaten",
  "many",
  "most",
  "how",
  "when",
  "where",
  "why",
  "its",
  "it",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "as",
]);

function getSerpKey() {
  return (process.env.SERP_API_KEY || "").trim();
}

function buildSearchQuery(questionText, correctOption) {
  const text = String(questionText || "").toLowerCase();
  const opt = String(correctOption || "").toLowerCase();
  const words = `${text} ${opt}`
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  const seen = new Set();
  const out = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 8) break;
  }
  if (out.length) return out.join(" ");
  const fallback = opt.replace(/[^a-z0-9]+/g, " ").trim();
  if (fallback) return fallback.slice(0, 80);
  return "abstract";
}

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });

/**
 * @param {string} questionText
 * @param {string} correctOption
 * @returns {Promise<string|null>} image URL or null
 */
async function resolveEmptyImageFromSerp(questionText, correctOption) {
  const key = getSerpKey();
  if (!key) return null;

  const query = buildSearchQuery(questionText, correctOption).slice(0, 80);
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);
  url.searchParams.set("ijn", "0");

  try {
    const data = await fetchJson(url.toString());
    const img = data?.images_results?.[0];
    return img?.original || img?.link || img?.thumbnail || null;
  } catch (e) {
    console.warn("[SerpAPI] image search failed:", e?.message || e);
    return null;
  }
}

/**
 * Pick first HTTPS image URL from common JSON shapes returned by custom APIs.
 * @param {unknown} obj
 * @returns {string|null}
 */
function pickImageUrlFromJson(obj) {
  if (obj == null) return null;
  if (Array.isArray(obj) && obj.length > 0) return pickImageUrlFromJson(obj[0]);
  if (typeof obj === "string") {
    const t = obj.trim();
    return /^https?:\/\//i.test(t) && t.length <= 2048 ? t : null;
  }
  if (typeof obj !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (obj);
  const tryStr = (v) => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return /^https?:\/\//i.test(t) && t.length <= 2048 ? t : null;
  };
  const direct = tryStr(o.imageUrl) || tryStr(o.url) || tryStr(o.link) || tryStr(o.image);
  if (direct) return direct;
  if (o.data != null) {
    const nested = pickImageUrlFromJson(o.data);
    if (nested) return nested;
  }
  if (Array.isArray(o.results) && o.results.length > 0) {
    const r = pickImageUrlFromJson(o.results[0]);
    if (r) return r;
  }
  if (Array.isArray(o.images_results) && o.images_results.length > 0) {
    const img = o.images_results[0];
    if (img && typeof img === "object") {
      const u = tryStr(img.original) || tryStr(img.link) || tryStr(img.thumbnail);
      if (u) return u;
    }
  }
  return null;
}

/**
 * GET a custom HTTPS URL with `{query}` replaced by an encoded search string.
 * Response: JSON (see pickImageUrlFromJson) or a plain body that is a single image URL.
 * @param {string} apiTemplate e.g. https://your.api/image?q={query}
 * @param {string} questionText
 * @param {string} correctOption
 * @returns {Promise<string|null>}
 */
async function resolveEmptyImageFromCustom(apiTemplate, questionText, correctOption) {
  const template = String(apiTemplate || "").trim();
  if (!template.includes("{query}") || template.length > 2048) return null;
  if (!/^https:\/\//i.test(template)) return null;

  const query = buildSearchQuery(questionText, correctOption).slice(0, 200);
  const urlStr = template.split("{query}").join(encodeURIComponent(query));

  try {
    const data = await new Promise((resolve, reject) => {
      https
        .get(urlStr, (res) => {
          let body = "";
          res.on("data", (c) => {
            body += c;
            if (body.length > 2000000) {
              res.destroy();
              reject(new Error("response too large"));
            }
          });
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              return reject(new Error(`HTTP ${res.statusCode}`));
            }
            resolve(body);
          });
        })
        .on("error", reject);
    });

    const trimmed = String(data).trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const json = JSON.parse(trimmed);
        const fromJson = pickImageUrlFromJson(json);
        if (fromJson) return fromJson;
      } catch {
        // fall through
      }
    }
    const plain = pickImageUrlFromJson(trimmed);
    return plain;
  } catch (e) {
    console.warn("[CustomImageAPI] request failed:", e?.message || e);
    return null;
  }
}

module.exports = {
  buildSearchQuery,
  resolveEmptyImageFromSerp,
  resolveEmptyImageFromCustom,
};

