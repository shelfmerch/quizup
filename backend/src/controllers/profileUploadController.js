const path = require("path");
const multer = require("multer");
const User = require("../models/User");

// Must match `app.use("/uploads", express.static(...))` in `app.js` (served from `backend/uploads`, not `backend/src/uploads`).
const uploadDir = path.join(__dirname, "..", "..", "uploads", "avatars");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || "").slice(0, 10) || ".png";
    cb(null, `avatar_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

// PUT /api/profile/avatar (protected) multipart/form-data field "avatar"
const uploadAvatar = [
  // ensure directory exists (multer doesn't create it)
  (req, _res, next) => {
    const fs = require("fs");
    fs.mkdirSync(uploadDir, { recursive: true });
    next();
  },
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(422).json({ error: "Missing avatar file" });

      const publicUrl = `/uploads/avatars/${req.file.filename}`;
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

