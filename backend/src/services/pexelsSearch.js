/**
 * Pexels photo search for auto-filling question imageUrl.
 * Set PEXELS_API_KEY (or PEXELS_API) on the server — see https://www.pexels.com/api/
 */

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

function getPexelsKey() {
  return (process.env.PEXELS_API_KEY || process.env.PEXELS_API || "").trim();
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
 * @param {string} questionText
 * @param {string} correctOption
 * @returns {Promise<string|null>} https image URL or null
 */
async function resolveEmptyImageFromPexels(questionText, correctOption) {
  const key = getPexelsKey();
  if (!key) return null;

  const query = buildSearchQuery(questionText, correctOption).slice(0, 80);
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "landscape");

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: key },
      signal: ac.signal,
    });
    if (!res.ok) {
      console.warn("[Pexels] HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const photo = data.photos && data.photos[0];
    if (!photo || !photo.src) return null;
    return photo.src.large || photo.src.medium || photo.src.original || null;
  } catch (e) {
    console.warn("[Pexels] search failed:", e.message || e);
    return null;
  } finally {
    clearTimeout(tid);
  }
}

module.exports = {
  buildSearchQuery,
  resolveEmptyImageFromPexels,
};
