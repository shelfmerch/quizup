const path = require("path");
const fs = require("fs");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, BUCKET, getPublicUrl } = require("../config/s3");

const VIDEO_MIME =
  /^video\/(mp4|quicktime|webm|x-matroska|3gpp|x-m4v|mpeg|x-msvideo)$/i;
const VIDEO_EXT = new Set(["mp4", "mov", "webm", "mkv", "m4v", "3gp"]);

function safeVideoExt(originalname) {
  const ext = String(originalname || "")
    .split(".")
    .pop()
    .toLowerCase()
    .slice(0, 10);
  return VIDEO_EXT.has(ext) ? ext : "mp4";
}

function videoFileFilter(_req, file, cb) {
  const mime = (file.mimetype || "").toLowerCase();
  const ext = safeVideoExt(file.originalname);

  if (VIDEO_MIME.test(mime)) return cb(null, true);
  if (VIDEO_EXT.has(ext)) return cb(null, true);
  if ((mime === "" || mime === "application/octet-stream") && VIDEO_EXT.has(ext)) {
    return cb(null, true);
  }
  cb(new Error("Only MP4, MOV, WebM, or MKV videos are allowed"));
}

function resolveUploadedVideoUrl(file) {
  if (!file) return null;
  if (file.location) return file.location;
  if (file.key && BUCKET) return getPublicUrl(file.key);
  if (file.filename) return `/uploads/community_posts/${file.filename}`;
  return null;
}

function buildVideoUploader() {
  const limits = { fileSize: 50 * 1024 * 1024 };

  if (!BUCKET) {
    const dest = path.join(__dirname, "..", "..", "uploads", "community_posts");
    fs.mkdirSync(dest, { recursive: true });
    return multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, dest),
        filename: (_req, file, cb) => {
          const ext = safeVideoExt(file.originalname);
          cb(null, `video_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
        },
      }),
      limits,
      fileFilter: videoFileFilter,
    });
  }

  return multer({
    storage: multerS3({
      s3,
      bucket: BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (_req, file, cb) => {
        const ext = safeVideoExt(file.originalname);
        cb(null, `community_posts/video_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
      },
    }),
    limits,
    fileFilter: videoFileFilter,
  });
}

const uploader = buildVideoUploader();

module.exports = uploader;
module.exports.resolveUploadedVideoUrl = resolveUploadedVideoUrl;
module.exports.videoFileFilter = videoFileFilter;
