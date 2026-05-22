const { createS3Upload, safeImageExt } = require("../middleware/createS3Upload");
const User = require("../models/User");

const upload = createS3Upload({
  maxSizeMb: 3,
  key: (_req, file, cb) => {
    const ext = safeImageExt(file.originalname);
    cb(null, `avatars/avatar_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
  },
});

// PUT /api/profile/avatar  (protected)  multipart/form-data field "avatar"
const uploadAvatar = [
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(422).json({ error: "Missing avatar file" });

      const publicUrl = req.file.location;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { avatarUrl: publicUrl } },
        { new: true }
      );

      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ user: user.toProfile(req.user._id.toString()) });
    } catch (err) {
      console.error("[Profile] uploadAvatar error:", err);
      return res.status(500).json({ error: err.message || "Server error" });
    }
  },
];

module.exports = { uploadAvatar };
