const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, BUCKET } = require("../config/s3");

// Allow images AND common video formats
const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|webm|x-matroska))$/i;

function safeExt(originalname) {
  const ext = String(originalname || "")
    .split(".")
    .pop()
    .toLowerCase()
    .slice(0, 10);
  const safe = new Set(["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm", "mkv"]);
  return safe.has(ext) ? ext : "bin";
}

const storage = multerS3({
  s3,
  bucket: BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (_req, file, cb) => {
    const ext = safeExt(file.originalname);
    cb(null, `chat_media/chat_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for videos
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only images and videos are allowed"));
  },
});
