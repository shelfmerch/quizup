const crypto = require("crypto");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const mime = require("mime-types");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, getPublicUrl, isOurS3Url } = require("../config/s3");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".avif"]);
const DEFAULT_EXT = ".jpg";

function extFromUrl(urlStr, contentType) {
  try {
    const u = new URL(urlStr);
    const last = u.pathname.split("/").pop() || "";
    const ext = path.extname(last).toLowerCase();
    if (IMAGE_EXT.has(ext)) return ext;
  } catch {
    /* ignore */
  }
  if (contentType) {
    const fromCt = mime.extension(contentType.split(";")[0].trim());
    if (fromCt) {
      const dotted = `.${fromCt.toLowerCase()}`;
      if (IMAGE_EXT.has(dotted)) return dotted;
    }
  }
  return DEFAULT_EXT;
}

function hashKey(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 24);
}

function fetchHeadersFor(urlStr) {
  let host = "";
  try {
    host = new URL(urlStr).hostname.toLowerCase();
  } catch {
    /* ignore */
  }
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (host.includes("tmdb.org") || host.includes("themoviedb.org")) {
    headers.Referer = "https://www.themoviedb.org/";
  }
  if (host.includes("pinimg.com") || host.includes("pinterest.")) {
    headers.Referer = "https://www.pinterest.com/";
  }
  return headers;
}

/** Download remote image (follows redirects). */
function fetchAsBuffer(urlStr, redirects = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch (e) {
      return reject(e);
    }
    const client = parsed.protocol === "http:" ? http : https;
    const req = client.get(
      parsed,
      {
        headers: fetchHeadersFor(urlStr),
        timeout: 20000,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new Error(`Too many redirects: ${urlStr}`));
          const next = new URL(res.headers.location, parsed).toString();
          return resolve(fetchAsBuffer(next, redirects - 1));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error(`HTTP ${status} for ${urlStr}`));
        }
        const chunks = [];
        let total = 0;
        res.on("data", (c) => {
          chunks.push(c);
          total += c.length;
          if (total > 20 * 1024 * 1024) {
            res.destroy();
            reject(new Error(`Image too large for ${urlStr}`));
          }
        });
        res.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            contentType: String(res.headers["content-type"] || ""),
          });
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Timeout fetching ${urlStr}`)));
    req.on("error", reject);
  });
}

/**
 * Copy a remote image into our S3 bucket (SearchStack / SerpAPI / Unsplash / etc.).
 * Returns the S3 URL, or the original URL if S3 is off or mirroring fails.
 * @param {string|null|undefined} sourceUrl
 * @returns {Promise<string|null>}
 */
async function mirrorRemoteImageToS3(sourceUrl) {
  if (sourceUrl == null) return null;
  const trimmed = String(sourceUrl).trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!BUCKET) return trimmed;
  if (isOurS3Url(trimmed)) return trimmed;

  try {
    const { body, contentType } = await fetchAsBuffer(trimmed);
    const ext = extFromUrl(trimmed, contentType);
    const key = `migrated/${hashKey(trimmed)}${ext}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType || mime.lookup(ext) || "image/jpeg",
      })
    );
    const s3Url = getPublicUrl(key);
    console.log(`[S3] mirrored search image → ${s3Url}`);
    return s3Url;
  } catch (err) {
    console.warn(`[S3] mirror failed, keeping source URL: ${err?.message || err}`);
    return trimmed;
  }
}

module.exports = { mirrorRemoteImageToS3, fetchAsBuffer };
