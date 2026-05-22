const { createS3Upload, safeMediaExt, mediaFileFilter } = require("./createS3Upload");

module.exports = createS3Upload({
  maxSizeMb: 50,
  fileFilter: mediaFileFilter,
  safeExt: safeMediaExt,
  key: (_req, file, cb) => {
    const ext = safeMediaExt(file.originalname);
    cb(null, `community_posts/video_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
  },
});
