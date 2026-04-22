/**
 * migrateImagesToS3.js
 *
 * Uploads every local image from backend/uploads/** to S3, organised by
 * category prefix, then patches the matching DB records so that
 * Question.imageUrl and User.avatarUrl point to the new S3 URLs.
 *
 * Run once:
 *   cd backend
 *   node src/scripts/migrateImagesToS3.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET } = require("../config/s3");

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Question = require("../models/Question");
const User = require("../models/User");

// ─── Map: local folder → S3 key prefix ──────────────────────────────────────
// The prefix becomes the first segment of the S3 key so images stay organised.
const FOLDER_MAP = [
    { localDir: "avatars", s3Prefix: "avatars" },
    { localDir: "food", s3Prefix: "uploads/food" },
    { localDir: "logos-seed", s3Prefix: "uploads/logos-seed" },
    { localDir: "pak-dramas-seed", s3Prefix: "uploads/pak-dramas-seed" },
    { localDir: "squid-seed", s3Prefix: "uploads/squid-seed" },
    { localDir: "questions", s3Prefix: "uploads/questions" },
    // Loose files sitting directly in uploads/
    { localDir: ".", s3Prefix: "uploads", filesOnly: true },
];

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function uploadFile(localPath, s3Key) {
    const body = fs.readFileSync(localPath);
    const contentType = mime.lookup(localPath) || "application/octet-stream";

    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: s3Key,
            Body: body,
            ContentType: contentType,
        })
    );
    return `https://${BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${s3Key}`;
}

/** Returns files (not dirs) in a directory, optionally non-recursively. */
function listFiles(dir, filesOnly = false) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => {
            const full = path.join(dir, f);
            if (!fs.statSync(full).isFile()) return false;
            if (filesOnly) return true; // already filtered out dirs
            return true;
        });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log("🔗  Connecting to MongoDB…");
    await connectDB();

    // localPath (relative to UPLOADS_ROOT) → s3 public URL
    const urlMap = {}; // e.g.  "food/pizza.png" → "https://..."

    // ── 1. Upload all files ──────────────────────────────────────────────────
    for (const { localDir, s3Prefix, filesOnly } of FOLDER_MAP) {
        const absDir = path.join(UPLOADS_ROOT, localDir);
        const files = listFiles(absDir, filesOnly);

        for (const filename of files) {
            // Skip non-image files sitting in the root (e.g. backup text files)
            const ext = path.extname(filename).toLowerCase();
            if (![".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) continue;

            const localPath = path.join(absDir, filename);
            const s3Key = `${s3Prefix}/${filename}`;

            process.stdout.write(`  ↑ Uploading ${s3Key} … `);
            try {
                const url = await uploadFile(localPath, s3Key);

                // Build the mapping key that matches how the DB stores local URLs.
                // DB stores paths like:
                //   /uploads/food/pizza.png     (with leading slash, relative to uploads root)
                //   /uploads/avatars/avatar_xxx.png
                //   /uploads/squid-seed/...
                //   /uploads/logos-seed/...
                //   /uploads/pak-dramas-seed/...
                const dbPath = localDir === "."
                    ? `/uploads/${filename}`                    // loose files
                    : localDir === "avatars"
                        ? `/uploads/avatars/${filename}`          // avatar path convention
                        : `/${s3Prefix}/${filename}`;             // question images

                urlMap[dbPath] = url;
                console.log("✅");
            } catch (err) {
                console.log(`❌  ${err.message}`);
            }
        }
    }

    console.log(`\n📦  Uploaded ${Object.keys(urlMap).length} file(s). Patching DB…\n`);

    // ── 2. Patch Question.imageUrl ───────────────────────────────────────────
    let qPatched = 0;
    const questions = await Question.find({
        imageUrl: { $ne: null, $not: /^https?:\/\// },
    }).select("_id imageUrl");

    for (const q of questions) {
        const newUrl = urlMap[q.imageUrl];
        if (!newUrl) {
            console.warn(`  ⚠  No S3 URL found for question imageUrl="${q.imageUrl}" (id=${q._id})`);
            continue;
        }
        await Question.findByIdAndUpdate(q._id, { imageUrl: newUrl });
        console.log(`  ✔ Question ${q._id}: ${q.imageUrl} → ${newUrl}`);
        qPatched++;
    }

    // ── 3. Patch User.avatarUrl ──────────────────────────────────────────────
    let uPatched = 0;
    const users = await User.find({
        avatarUrl: { $ne: null, $not: /^https?:\/\// },
    }).select("_id avatarUrl username");

    for (const u of users) {
        const newUrl = urlMap[u.avatarUrl];
        if (!newUrl) {
            console.warn(`  ⚠  No S3 URL found for user avatarUrl="${u.avatarUrl}" (${u.username})`);
            continue;
        }
        await User.findByIdAndUpdate(u._id, { avatarUrl: newUrl });
        console.log(`  ✔ User ${u.username}: ${u.avatarUrl} → ${newUrl}`);
        uPatched++;
    }

    console.log(`\n✅  Done. Patched ${qPatched} question(s) and ${uPatched} user avatar(s).`);
    process.exit(0);
}

main().catch((err) => {
    console.error("❌  Migration failed:", err);
    process.exit(1);
});
