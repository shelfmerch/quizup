const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, BUCKET } = require("../config/s3");

const IMAGE_MIME = /^image\/(jpeg|png|gif|webp)$/i;
const SAFE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function safeImageExt(originalname) {
  const ext = String(originalname || "")
    .split(".")
    .pop()
    .toLowerCase()
    .slice(0, 10);
  return SAFE_EXT.has(ext) ? ext : "png";
}

/**
 * @param {{ key: (req: import('express').Request, file: Express.Multer.File, cb: (err: Error | null, key?: string) => void) => void, maxSizeMb?: number }} opts
 */
function createS3Upload({ key, maxSizeMb = 2 }) {
  if (!BUCKET) {
    throw new Error("S3_BUCKET_NAME is not configured");
  }

  const storage = multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key,
  });

  return multer({
    storage,
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (IMAGE_MIME.test(file.mimetype)) return cb(null, true);
      cb(new Error("Only JPEG, PNG, GIF, or WebP images are allowed"));
    },
  });
}

module.exports = { createS3Upload, safeImageExt };
