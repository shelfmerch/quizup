const fs = require("fs");
const path = require("path");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, BUCKET, getPublicUrl } = require("../config/s3");

const IMAGE_MIME = /^image\/(jpeg|jpe?g|png|gif|webp|heic|heif|svg\+xml|pjpeg)$/i;
const SAFE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function safeImageExt(originalname) {
  const ext = String(originalname || "")
    .split(".")
    .pop()
    .toLowerCase()
    .slice(0, 10);
  return SAFE_EXT.has(ext) ? ext : "png";
}

function imageFileFilter(_req, file, cb) {
  if (IMAGE_MIME.test(file.mimetype)) return cb(null, true);
  const ext = safeImageExt(file.originalname);
  if (SAFE_EXT.has(ext)) return cb(null, true);
  cb(new Error("Only JPEG, PNG, GIF, or WebP images are allowed"));
}

/**
 * Browser-loadable URL after multer upload (S3 or local disk).
 * @param {Express.Multer.File | undefined} file
 */
function resolveUploadedImageUrl(file) {
  if (!file) return null;
  if (file.location) return file.location;
  if (file.key && BUCKET) return getPublicUrl(file.key);
  if (file.filename) return `/uploads/community_posts/${file.filename}`;
  return null;
}

/**
 * @param {{ key: (req: import('express').Request, file: Express.Multer.File, cb: (err: Error | null, key?: string) => void) => void, maxSizeMb?: number }} opts
 */
function createS3Upload({ key, maxSizeMb = 2 }) {
  const limits = { fileSize: maxSizeMb * 1024 * 1024 };

  if (!BUCKET) {
    const dest = path.join(__dirname, "..", "..", "uploads", "community_posts");
    fs.mkdirSync(dest, { recursive: true });
    return multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, dest),
        filename: (_req, file, cb) => {
          const ext = safeImageExt(file.originalname);
          cb(null, `post_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
        },
      }),
      limits,
      fileFilter: imageFileFilter,
    });
  }

  const storage = multerS3({
    s3,
    bucket: BUCKET,
    contentType: (_req, file, cb) => {
      cb(null, file.mimetype || "application/octet-stream");
    },
    key,
  });

  return multer({
    storage,
    limits,
    fileFilter: imageFileFilter,
  });
}

module.exports = { createS3Upload, safeImageExt, resolveUploadedImageUrl, imageFileFilter };
