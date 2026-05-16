/**
 * migrateAllImagesToS3.js
 *
 * Walks every Question.imageUrl and Category.icon in MongoDB and ensures the
 * image is hosted on our S3 bucket. Three cases are handled:
 *
 *   1. Already on our bucket  →  skipped (idempotent).
 *   2. Local "/uploads/..." path  →  reads the file from backend/uploads
 *      and uploads it.
 *   3. Any other http(s) URL (Pexels, SerpAPI, Dicebear, etc.)  →  streams
 *      the remote image, then uploads it to S3.
 *
 * After upload, the matching document is patched to point at the new
 * public S3 URL.
 *
 * Run:
 *   cd backend
 *   npm run migrate:images:s3              # questions + categories
 *   npm run migrate:images:s3 -- --dry-run # report only, no writes
 *
 * Flags:
 *   --dry-run            don't upload or patch the DB, just show what would happen
 *   --questions-only     skip categories
 *   --categories-only    skip questions
 *   --category=slug      restrict to a single category slug
 *   --concurrency=N      parallel uploads (default 4, max 16)
 *   --skip-on-error      keep going past a failure (default: continue, never abort)
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const mime = require("mime-types");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, REGION, getPublicUrl, isOurS3Url } = require("../config/s3");

const mongoose = require("mongoose");
const Question = require("../models/Question");
const Category = require("../models/Category");
const User = require("../models/User");
const CommunityPost = require("../models/CommunityPost");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".avif"]);
const DEFAULT_EXT = ".jpg";

// ─── CLI ─────────────────────────────────────────────────────────────────────

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function flagValue(name, defaultVal = null) {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(`--${name}=`.length);
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return defaultVal;
}

const DRY_RUN = flag("dry-run");
const QUESTIONS_ONLY = flag("questions-only");
const CATEGORIES_ONLY = flag("categories-only");
const USERS_ONLY = flag("users-only");
const COMMUNITY_ONLY = flag("community-only");
const CATEGORY_FILTER = flagValue("category");
const CONCURRENCY = Math.max(1, Math.min(16, Number(flagValue("concurrency", "4")) || 4));

const runQuestions =
  QUESTIONS_ONLY || (!CATEGORIES_ONLY && !USERS_ONLY && !COMMUNITY_ONLY);
const runCategories =
  CATEGORIES_ONLY || (!QUESTIONS_ONLY && !USERS_ONLY && !COMMUNITY_ONLY);
const runUsers =
  USERS_ONLY || (!QUESTIONS_ONLY && !CATEGORIES_ONLY && !COMMUNITY_ONLY);
const runCommunity =
  COMMUNITY_ONLY || (!QUESTIONS_ONLY && !CATEGORIES_ONLY && !USERS_ONLY);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOnOurBucket(url) {
  return isOurS3Url(url);
}

function isHttpUrl(s) {
  return typeof s === "string" && /^https?:\/\//i.test(s.trim());
}

function isLocalUploadsPath(s) {
  return typeof s === "string" && s.trim().startsWith("/uploads/");
}

function isEmojiOrShortIcon(s) {
  if (typeof s !== "string") return true;
  const t = s.trim();
  if (!t) return true;
  if (isHttpUrl(t)) return false;
  if (t.startsWith("/")) return false;
  if (t.startsWith("data:")) return false;
  return true;
}

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

function s3PublicUrl(key) {
  return getPublicUrl(key);
}

/** Stream an http(s) URL into a Buffer (following up to 5 redirects). */
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
        headers: {
          "User-Agent":
            "QuizUpImageMigrator/1.0 (+https://quizup.local) Node",
          Accept: "image/*,*/*;q=0.8",
        },
        timeout: 20000,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) {
            return reject(new Error(`Too many redirects (last: ${urlStr})`));
          }
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
            reject(new Error(`Image too large (>20MB) for ${urlStr}`));
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
    req.on("timeout", () => {
      req.destroy(new Error(`Timeout while fetching ${urlStr}`));
    });
    req.on("error", reject);
  });
}

async function putToS3(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );
  return s3PublicUrl(key);
}

/**
 * Returns a new public S3 URL for `imageUrl`, or null if nothing to do
 * (already on bucket, or unsupported). For dry-runs, returns the URL that
 * would be created without actually uploading.
 */
async function migrateOne(imageUrl, contextLabel) {
  if (!imageUrl || typeof imageUrl !== "string") return { status: "skip", reason: "empty" };
  const trimmed = imageUrl.trim();
  if (!trimmed) return { status: "skip", reason: "empty" };

  if (isOnOurBucket(trimmed)) {
    return { status: "skip", reason: "already-on-s3" };
  }

  // 1) Local /uploads/... → upload from disk
  if (isLocalUploadsPath(trimmed)) {
    const rel = trimmed.replace(/^\/uploads\//, "");
    const safe = rel.replace(/\\/g, "/").split("/").filter((p) => p && p !== "..").join("/");
    const abs = path.join(UPLOADS_ROOT, safe);
    if (!fs.existsSync(abs)) {
      return { status: "error", reason: `Local file missing: uploads/${safe}` };
    }
    const ext = path.extname(safe).toLowerCase();
    const key = safe.startsWith("avatars/") ? safe : `uploads/${safe}`;
    const contentType = mime.lookup(abs) || "application/octet-stream";
    if (DRY_RUN) {
      return { status: "would-upload-local", newUrl: s3PublicUrl(key), key };
    }
    const body = fs.readFileSync(abs);
    const newUrl = await putToS3(key, body, contentType);
    return { status: "uploaded-local", newUrl, key, bytes: body.length, ext };
  }

  // 2) http(s) URL on someone else's host → download then upload
  if (isHttpUrl(trimmed)) {
    if (DRY_RUN) {
      const ext = extFromUrl(trimmed, "");
      const key = `migrated/${hashKey(trimmed)}${ext}`;
      return { status: "would-download-and-upload", newUrl: s3PublicUrl(key), key };
    }
    const { body, contentType } = await fetchAsBuffer(trimmed);
    const ext = extFromUrl(trimmed, contentType);
    const key = `migrated/${hashKey(trimmed)}${ext}`;
    const newUrl = await putToS3(key, body, contentType || mime.lookup(ext) || "image/jpeg");
    return { status: "uploaded-remote", newUrl, key, bytes: body.length, ext, contentType };
  }

  // 3) Anything else (emoji icon, data: URI, weird value)
  return { status: "skip", reason: "not-an-image-url", label: contextLabel };
}

// ─── Concurrency helper ──────────────────────────────────────────────────────

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  let active = 0;
  return new Promise((resolve) => {
    const launch = () => {
      while (active < limit && next < items.length) {
        const i = next++;
        active++;
        Promise.resolve()
          .then(() => worker(items[i], i))
          .then((r) => {
            results[i] = r;
          })
          .catch((err) => {
            results[i] = { status: "error", reason: err?.message || String(err) };
          })
          .finally(() => {
            active--;
            if (next >= items.length && active === 0) resolve(results);
            else launch();
          });
      }
    };
    if (items.length === 0) resolve(results);
    else launch();
  });
}

// ─── Migrators ───────────────────────────────────────────────────────────────

async function migrateQuestions() {
  const filter = { imageUrl: { $nin: [null, ""] } };
  if (CATEGORY_FILTER) filter.categoryId = String(CATEGORY_FILTER).toLowerCase();

  const total = await Question.countDocuments(filter);
  console.log(`\n📋  Questions with imageUrl: ${total}${CATEGORY_FILTER ? ` (category=${CATEGORY_FILTER})` : ""}`);
  if (total === 0) return { processed: 0, uploaded: 0, skipped: 0, errors: 0 };

  const docs = await Question.find(filter).select("_id imageUrl categoryId text").lean();

  const counts = { processed: 0, uploaded: 0, skipped: 0, errors: 0 };

  await runWithConcurrency(docs, CONCURRENCY, async (q) => {
    counts.processed++;
    const label = `Q ${q._id} [${q.categoryId}]`;
    try {
      const result = await migrateOne(q.imageUrl, label);

      if (result.status === "skip") {
        counts.skipped++;
        return result;
      }
      if (result.status === "error") {
        counts.errors++;
        console.warn(`  ⚠  ${label}: ${result.reason} (was ${q.imageUrl})`);
        return result;
      }

      const isDry = result.status.startsWith("would-");
      const oldUrl = q.imageUrl;
      const newUrl = result.newUrl;

      if (!isDry) {
        await Question.updateOne({ _id: q._id }, { $set: { imageUrl: newUrl } });
        counts.uploaded++;
        console.log(`  ✔  ${label}: ${oldUrl} → ${newUrl}`);
      } else {
        counts.uploaded++;
        console.log(`  ◌  ${label}: ${oldUrl} → ${newUrl}  (dry-run)`);
      }
      return result;
    } catch (err) {
      counts.errors++;
      console.warn(`  ✗  ${label}: ${err?.message || err} (was ${q.imageUrl})`);
      return { status: "error", reason: err?.message || String(err) };
    }
  });

  return counts;
}

async function migrateCategories() {
  const filter = {};
  if (CATEGORY_FILTER) filter.slug = String(CATEGORY_FILTER).toLowerCase();

  const cats = await Category.find(filter).select("_id slug name icon").lean();
  const migratable = cats.filter((c) => !isEmojiOrShortIcon(c.icon || ""));
  console.log(`\n📋  Categories with image-like icon: ${migratable.length}/${cats.length}${CATEGORY_FILTER ? ` (slug=${CATEGORY_FILTER})` : ""}`);
  if (migratable.length === 0) return { processed: 0, uploaded: 0, skipped: 0, errors: 0 };

  const counts = { processed: 0, uploaded: 0, skipped: 0, errors: 0 };

  await runWithConcurrency(migratable, CONCURRENCY, async (c) => {
    counts.processed++;
    const label = `Cat ${c.slug}`;
    try {
      const result = await migrateOne(c.icon, label);

      if (result.status === "skip") {
        counts.skipped++;
        return result;
      }
      if (result.status === "error") {
        counts.errors++;
        console.warn(`  ⚠  ${label}: ${result.reason} (was ${c.icon})`);
        return result;
      }

      const isDry = result.status.startsWith("would-");
      const oldUrl = c.icon;
      const newUrl = result.newUrl;

      if (!isDry) {
        await Category.updateOne({ _id: c._id }, { $set: { icon: newUrl } });
        counts.uploaded++;
        console.log(`  ✔  ${label}: ${oldUrl} → ${newUrl}`);
      } else {
        counts.uploaded++;
        console.log(`  ◌  ${label}: ${oldUrl} → ${newUrl}  (dry-run)`);
      }
      return result;
    } catch (err) {
      counts.errors++;
      console.warn(`  ✗  ${label}: ${err?.message || err} (was ${c.icon})`);
      return { status: "error", reason: err?.message || String(err) };
    }
  });

  return counts;
}

async function migrateCollection({
  model,
  field,
  filter,
  labelFn,
  sectionTitle,
}) {
  const total = await model.countDocuments(filter);
  console.log(`\n📋  ${sectionTitle}: ${total}`);
  if (total === 0) return { processed: 0, uploaded: 0, skipped: 0, errors: 0 };

  const docs = await model.find(filter).select(`_id ${field}`).lean();
  const counts = { processed: 0, uploaded: 0, skipped: 0, errors: 0 };

  await runWithConcurrency(docs, CONCURRENCY, async (doc) => {
    counts.processed++;
    const label = labelFn(doc);
    const current = doc[field];
    try {
      const result = await migrateOne(current, label);
      if (result.status === "skip") {
        counts.skipped++;
        return result;
      }
      if (result.status === "error") {
        counts.errors++;
        console.warn(`  ⚠  ${label}: ${result.reason} (was ${current})`);
        return result;
      }
      const isDry = result.status.startsWith("would-");
      const newUrl = result.newUrl;
      if (!isDry) {
        await model.updateOne({ _id: doc._id }, { $set: { [field]: newUrl } });
        counts.uploaded++;
        console.log(`  ✔  ${label}: ${current} → ${newUrl}`);
      } else {
        counts.uploaded++;
        console.log(`  ◌  ${label}: ${current} → ${newUrl}  (dry-run)`);
      }
      return result;
    } catch (err) {
      counts.errors++;
      console.warn(`  ✗  ${label}: ${err?.message || err} (was ${current})`);
      return { status: "error", reason: err?.message || String(err) };
    }
  });

  return counts;
}

async function migrateUsers() {
  return migrateCollection({
    model: User,
    field: "avatarUrl",
    filter: { avatarUrl: { $nin: [null, ""] } },
    labelFn: (u) => `User ${u._id}`,
    sectionTitle: "Users with avatarUrl",
  });
}

async function migrateCommunityPosts() {
  return migrateCollection({
    model: CommunityPost,
    field: "imageUrl",
    filter: { imageUrl: { $nin: [null, ""] } },
    labelFn: (p) => `Post ${p._id}`,
    sectionTitle: "Community posts with imageUrl",
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!BUCKET) throw new Error("S3_BUCKET_NAME is not set in .env");
  if (!process.env.AWS_ACCESS_KEY || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY missing in .env");
  }
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  console.log("🛠   S3 image migration");
  console.log(`     bucket:       s3://${BUCKET}  (region ${REGION})`);
  console.log(`     concurrency:  ${CONCURRENCY}`);
  console.log(`     dry-run:      ${DRY_RUN ? "YES (no writes)" : "no"}`);
  if (CATEGORY_FILTER) console.log(`     category:     ${CATEGORY_FILTER}`);
  if (QUESTIONS_ONLY) console.log("     scope:        questions only");
  if (CATEGORIES_ONLY) console.log("     scope:        categories only");
  if (USERS_ONLY) console.log("     scope:        users only");
  if (COMMUNITY_ONLY) console.log("     scope:        community posts only");

  const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
  const testKey = `_healthcheck/pre-migrate-${Date.now()}.txt`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: testKey,
        Body: Buffer.from("ok"),
        ContentType: "text/plain",
      })
    );
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: testKey }));
    console.log("     s3 write:     OK");
  } catch (e) {
    throw new Error(
      `S3 PutObject denied — attach s3:PutObject on arn:aws:s3:::${BUCKET}/* to your IAM user. ${e.message}`
    );
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  console.log(`     mongo:        connected to ${mongoose.connection.host}`);

  const qCounts = runQuestions ? await migrateQuestions() : null;
  const cCounts = runCategories ? await migrateCategories() : null;
  const uCounts = runUsers ? await migrateUsers() : null;
  const pCounts = runCommunity ? await migrateCommunityPosts() : null;

  await mongoose.disconnect();

  console.log("\n──────────── Summary ────────────");
  if (qCounts) {
    console.log(
      `Questions   processed=${qCounts.processed}  migrated=${qCounts.uploaded}  skipped=${qCounts.skipped}  errors=${qCounts.errors}`
    );
  }
  if (cCounts) {
    console.log(
      `Categories  processed=${cCounts.processed}  migrated=${cCounts.uploaded}  skipped=${cCounts.skipped}  errors=${cCounts.errors}`
    );
  }
  if (uCounts) {
    console.log(
      `Users       processed=${uCounts.processed}  migrated=${uCounts.uploaded}  skipped=${uCounts.skipped}  errors=${uCounts.errors}`
    );
  }
  if (pCounts) {
    console.log(
      `Community   processed=${pCounts.processed}  migrated=${pCounts.uploaded}  skipped=${pCounts.skipped}  errors=${pCounts.errors}`
    );
  }
  console.log(`Mode        ${DRY_RUN ? "DRY RUN — nothing changed" : "WROTE to S3 and MongoDB"}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌  Migration failed:", err);
    process.exit(1);
  });
