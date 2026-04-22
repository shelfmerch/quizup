const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, BUCKET } = require("../config/s3");

// ── multer-s3 storage for admin question images ──────────────────────────────
const storage = multerS3({
  s3,
  bucket: BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop().toLowerCase().slice(0, 10);
    const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "png";
    cb(null, `questions/q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (ok) return cb(null, true);
    cb(new Error("Only JPEG, PNG, GIF, or WebP images are allowed"));
  },
});

module.exports = upload;
