const { createS3Upload, safeImageExt } = require("./createS3Upload");

module.exports = createS3Upload({
  maxSizeMb: 5,
  key: (_req, file, cb) => {
    const ext = safeImageExt(file.originalname);
    cb(null, `community_posts/post_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
  },
});
