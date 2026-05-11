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

module.exports = {
  buildSearchQuery,
  resolveEmptyImageFromSerp,
};

