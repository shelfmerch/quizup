/**
 * migrateImagesToS3.js
 *
 * Uploads every local image from backend/uploads/** to S3, organised by
 * category prefix, then patches the matching DB records so that
 * Question.imageUrl and User.avatarUrl point to the new S3 URLs.
 *
 * Run once:
 *   cd backend
 *   npm run migrate:s3
 *
 * S3 only (no MongoDB — e.g. offline or copy assets first):
 *   node src/scripts/migrateImagesToS3.js --upload-only
 *
 * Only certain subfolders under uploads/ (comma-separated names, no "uploads/" prefix):
 *   node src/scripts/migrateImagesToS3.js --upload-only --folders=name-the-celebrity-seed,name-the-animal-seed
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET } = require("../config/s3");

const mongoose = require("mongoose");
const Question = require("../models/Question");
const User = require("../models/User");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "..", "uploads");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** S3 keys for avatars match multer-s3 (`avatars/...`); everything else uses `uploads/<relative>`. */
function relPathToS3Key(relPosix) {
    return relPosix.startsWith("avatars/") ? relPosix : `uploads/${relPosix}`;
}

/** DB and API use paths like `/uploads/food/pizza.png` or `/uploads/avatars/...`. */
function relPathToDbPath(relPosix) {
    return `/uploads/${relPosix}`;
}

/** Parse `--folders=a,b` or `--folders a,b` → ["a","b"]; null means walk entire uploads/. */
function parseFolderFilter() {
    const eq = process.argv.find((a) => a.startsWith("--folders="));
    if (eq) {
        return eq
            .slice("--folders=".length)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    const i = process.argv.indexOf("--folders");
    if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
        return process.argv[i + 1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return null;
}

/** Walk `uploads/` recursively; yields { fullPath, relPosix } for each image file. */
function* walkImageFiles(dir, baseRel = "") {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
        if (name.startsWith(".")) continue;
        const full = path.join(dir, name);
        const rel = baseRel ? path.join(baseRel, name) : name;
        const st = fs.statSync(full);
        if (st.isDirectory()) {
            yield* walkImageFiles(full, rel);
            continue;
        }
        const ext = path.extname(name).toLowerCase();
        if (!IMAGE_EXT.has(ext)) continue;
        yield { fullPath: full, relPosix: rel.split(path.sep).join("/") };
    }
}

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

async function connectForMigrate() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    console.log(`[MongoDB] Connected: ${mongoose.connection.host}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const uploadOnly = process.argv.includes("--upload-only");

    if (!BUCKET) {
        throw new Error("S3_BUCKET_NAME is not set in .env");
    }

    if (!uploadOnly) {
        console.log("🔗  Connecting to MongoDB…");
        await connectForMigrate();
    } else {
        console.log("📤  --upload-only: skipping MongoDB (S3 upload only).\n");
    }

    // DB path → S3 public URL (used when patching Mongo)
    const urlMap = {};

    // ── 1. Upload images (entire uploads/ or only --folders subdirs) ───────────
    const folderFilter = parseFolderFilter();
    /** @type {Generator<{fullPath: string, relPosix: string}>} */
    function* filesToUpload() {
        if (!folderFilter || folderFilter.length === 0) {
            yield* walkImageFiles(UPLOADS_ROOT);
            return;
        }
        for (const sub of folderFilter) {
            const safe = sub.replace(/\\/g, "/").split("/").filter((p) => p && p !== "..").join("/");
            if (!safe) continue;
            const abs = path.join(UPLOADS_ROOT, safe);
            if (!fs.existsSync(abs)) {
                console.warn(`  ⚠  Skipping missing folder: uploads/${safe}`);
                continue;
            }
            yield* walkImageFiles(abs, safe);
        }
    }

    for (const { fullPath, relPosix } of filesToUpload()) {
        const s3Key = relPathToS3Key(relPosix);
        const dbPath = relPathToDbPath(relPosix);

        process.stdout.write(`  ↑ Uploading ${s3Key} … `);
        try {
            const url = await uploadFile(fullPath, s3Key);
            urlMap[dbPath] = url;
            console.log("✅");
        } catch (err) {
            console.log(`❌  ${err.message}`);
        }
    }

    const uploaded = Object.keys(urlMap).length;
    console.log(`\n📦  Uploaded ${uploaded} file(s) to s3://${BUCKET}.`);

    if (uploadOnly) {
        console.log("\n✅  Done (upload-only; no DB changes). Run without --upload-only when MongoDB is reachable to patch Question.imageUrl and User.avatarUrl.");
        return;
    }

    console.log("Patching DB…\n");

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

    await mongoose.disconnect();

    console.log(`\n✅  Done. Patched ${qPatched} question(s) and ${uPatched} user avatar(s).`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌  Migration failed:", err);
        process.exit(1);
    });
