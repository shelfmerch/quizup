const multer = require("multer");
const multerS3 = require("multer-s3");
const { s3, BUCKET } = require("../config/s3");
const User = require("../models/User");

// ── multer-s3 storage for profile avatars ────────────────────────────────────
const storage = multerS3({
  s3,
  bucket: BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop().slice(0, 10) || "png";
    cb(null, `avatars/avatar_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error("Only JPEG, PNG, GIF, or WebP images are allowed"), ok);
  },
});

// PUT /api/profile/avatar  (protected)  multipart/form-data field "avatar"
const uploadAvatar = [
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(422).json({ error: "Missing avatar file" });

      // multer-s3 exposes the public URL on req.file.location
      const publicUrl = req.file.location;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { avatarUrl: publicUrl } },
        { new: true }
      );

      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ user: user.toProfile() });
    } catch (err) {
      console.error("[Profile] uploadAvatar error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  },
];

module.exports = { uploadAvatar };
