/**
 * SearchStack image search for auto-filling question imageUrl.
 * Calls the local SearchStack backend running on http://localhost:3001
 * Set SEARCHSTACK_KEY in backend/.env
 */
const http = require("http");
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

function getSearchStackKey() {
  return (process.env.SEARCHSTACK_KEY || "").trim();
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
 * Fetch JSON from a URL with optional Bearer token.
 * Automatically uses http for localhost, https for external.
 * @param {string} urlStr
 * @param {string} [bearerToken]
 * @returns {Promise<any>}
 */
const fetchJson = (urlStr, bearerToken) =>
  new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const transport = parsedUrl.protocol === "http:" ? http : https;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "http:" ? 80 : 443),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "Accept": "application/json",
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
    };
    const req = transport.request(options, (res) => {
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
    });
    req.on("error", reject);
    req.end();
  });

/**
 * Search for an image via local SearchStack backend and return the first image URL.
 * Endpoint: GET http://localhost:3005/api/v1/images?q=...
 * @param {string} questionText
 * @param {string} correctOption
 * @returns {Promise<string|null>} image URL or null
 */
const axios = require("axios");
const { mirrorRemoteImageToS3 } = require("./mirrorImageToS3");

async function resolveEmptyImageFromSerp(questionText, correctOption, directQuery = null) {
  const key = getSearchStackKey();
  if (!key) {
    console.warn("[SearchStack] SEARCHSTACK_KEY not set — skipping image fetch");
    return null;
  }

  const query = directQuery ? directQuery.trim().slice(0, 80) : buildSearchQuery(questionText, correctOption).slice(0, 80);

  console.log(`[SearchStack] fetching image with axios for query: "${query}"`);

  try {
    // Note: User provided https://api.searchstack.dev/v1/search but it throws ENOTFOUND locally,
    // so we use the local URL. The endpoint for images is /api/v1/images.
    const { data } = await axios.get(
      "http://localhost:3005/api/v1/images",
      {
        params: {
          q: query,
          gl: "us",
          hl: "en",
        },
        headers: {
          Authorization: `Bearer ${key}`,
        },
      }
    );

    // Log full response for debugging
    if (!data?.success) {
      console.warn("[SearchStack] API error response:", JSON.stringify(data));
      return null;
    }

    // SearchStack response shape (spread by sendSuccess):
    // { success: true, engine: "google_images", results: { images: [{ imageUrl, thumbnailUrl, link }] } }
    const img = data?.results?.images?.[0];
    if (img && typeof img === "object") {
      const u = img.imageUrl || img.thumbnailUrl || img.link;
      if (u && typeof u === "string" && /^https?:\/\//i.test(u)) {
        console.log(`[SearchStack] resolved image: ${u}`);
        return mirrorRemoteImageToS3(u);
      }
    }

    // Generic fallback picker
    const fallback = pickImageUrlFromJson(data);
    if (fallback) {
      console.log(`[SearchStack] fallback image: ${fallback}`);
      return mirrorRemoteImageToS3(fallback);
    }

    console.warn("[SearchStack] no image found in response:", JSON.stringify(data).slice(0, 300));
    return null;
  } catch (e) {
    console.warn("[SearchStack] image search failed:", e?.response?.data || e?.message || e);
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
  if (Array.isArray(o.images) && o.images.length > 0) {
    const img = o.images[0];
    if (img && typeof img === "object") {
      const u =
        tryStr(img.original) ||
        tryStr(img.originalUrl) ||
        tryStr(img.url) ||
        tryStr(img.link) ||
        tryStr(img.thumbnail);
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
        if (fromJson) return mirrorRemoteImageToS3(fromJson);
      } catch {
        // fall through
      }
    }
    const plain = pickImageUrlFromJson(trimmed);
    return plain ? mirrorRemoteImageToS3(plain) : null;
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
