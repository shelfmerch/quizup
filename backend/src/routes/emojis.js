const express = require("express");

const router = express.Router();

const EMOJI_API = "https://www.emoji.family/api/emojis";
const CACHE_TTL_MS = 60 * 60 * 1000;
/** @type {Map<string, { at: number, data: unknown }>} */
const cache = new Map();

function cacheKey(query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null && String(v).trim()) qs.set(k, String(v).trim());
  }
  const s = qs.toString();
  return s || "group=smileys-emotion";
}

router.get("/", async (req, res) => {
  try {
    const key = cacheKey(req.query);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.json(hit.data);
    }

    const qs = new URLSearchParams();
    if (req.query.group) qs.set("group", String(req.query.group));
    if (req.query.search) qs.set("search", String(req.query.search));
    if (req.query.tag) qs.set("tag", String(req.query.tag));
    if (req.query.subgroup) qs.set("subgroup", String(req.query.subgroup));

    const url = qs.toString() ? `${EMOJI_API}?${qs}` : `${EMOJI_API}?group=smileys-emotion`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Could not load emojis from provider" });
    }

    const data = await upstream.json();
    if (!Array.isArray(data)) {
      return res.status(502).json({ error: "Invalid emoji response" });
    }

    cache.set(key, { at: Date.now(), data });
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.json(data);
  } catch (err) {
    const msg = err?.name === "AbortError" ? "Emoji provider timed out" : err?.message || "Proxy error";
    console.error("[Emojis] proxy error:", msg);
    return res.status(502).json({ error: "Could not load emojis" });
  }
});

module.exports = router;
