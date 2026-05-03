const https = require("https");

const fetchJson = (url, headers = {}) =>
  new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
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
 * @param {string} query
 * @param {string} apiKey
 * @returns {Promise<string|null>}
 */
const fetchPexelsImageUrl = async (query, apiKey) => {
  if (!apiKey || !query) return null;
  const q = encodeURIComponent(query);
  const json = await fetchJson(`https://api.pexels.com/v1/search?query=${q}&per_page=1&size=medium`, {
    Authorization: apiKey,
  });
  const p = json?.photos?.[0];
  return p?.src?.large || p?.src?.medium || null;
};

/**
 * Unsplash for animal-style queries when UNSPLASH_ACCESS_KEY is set.
 * @param {string} query
 * @param {string} accessKey
 * @returns {Promise<string|null>}
 */
const fetchUnsplashImageUrl = async (query, accessKey) => {
  if (!accessKey || !query) return null;
  const q = encodeURIComponent(query);
  const json = await fetchJson(`https://api.unsplash.com/search/photos?query=${q}&per_page=1`, {
    Authorization: `Client-ID ${accessKey}`,
  });
  const r = json?.results?.[0]?.urls?.regular || json?.results?.[0]?.urls?.small;
  return r || null;
};

/**
 * Clearbit Logo API — pass registrable domain (e.g. spotify.com).
 * @param {string} domain
 * @returns {string|null}
 */
const clearbitLogoUrl = (domain) => {
  if (!domain || typeof domain !== "string") return null;
  const d = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return null;
  return `https://logo.clearbit.com/${d}`;
};

/**
 * Pick image URL using tags + query heuristics.
 * @param {{ imageQuery?: string, tags?: string[], questionType: "IMAGE"|"TEXT" }} args
 */
const resolveImageUrl = async (args) => {
  const { imageQuery = "", tags = [], questionType } = args;
  if (questionType !== "IMAGE") return null;

  const pexelsKey = process.env.PEXELS_API_KEY || "";
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || "";

  const tagStr = tags.map((t) => String(t).toLowerCase()).join(" ");
  const q = imageQuery || "";

  const isLogo =
    tagStr.includes("logo") ||
    tagStr.includes("brand") ||
    tagStr.includes("company") ||
    /\b(inc|corp|ltd)\b/i.test(q);

  if (isLogo) {
    const domainGuess = q.includes(".") ? q.split(/\s+/).find((p) => p.includes(".")) : null;
    if (domainGuess) {
      const url = clearbitLogoUrl(domainGuess);
      if (url) return url;
    }
  }

  const isAnimal = tagStr.includes("animal") || tagStr.includes("wildlife") || tagStr.includes("mammal");

  if (isAnimal && unsplashKey) {
    const u = await fetchUnsplashImageUrl(q || tags[0] || "animal", unsplashKey).catch(() => null);
    if (u) return u;
  }

  if (pexelsKey) {
    const p = await fetchPexelsImageUrl(q || tags.join(" ") || "quiz", pexelsKey).catch(() => null);
    if (p) return p;
  }

  if (unsplashKey) {
    const u = await fetchUnsplashImageUrl(q || "abstract", unsplashKey).catch(() => null);
    if (u) return u;
  }

  return null;
};

module.exports = {
  fetchPexelsImageUrl,
  fetchUnsplashImageUrl,
  clearbitLogoUrl,
  resolveImageUrl,
};
