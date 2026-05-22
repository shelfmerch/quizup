const uploadPostImage = require("../middleware/uploadPostImage");
const { resolveUploadedImageUrl } = require("../middleware/createS3Upload");

function sendUploadedImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const imageUrl = resolveUploadedImageUrl(req.file);
    if (!imageUrl) {
      return res.status(500).json({ error: "Upload did not return a file URL" });
    }

    return res.json({ imageUrl });
  } catch (err) {
    console.error("[Community] upload-image error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/** Multer wrapper — surfaces validation/S3 errors as 4xx instead of generic 500. */
function uploadCommunityImage(req, res) {
  uploadPostImage.single("image")(req, res, (err) => {
    if (err) {
      console.error("[Community] multer upload error:", err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Image must be 5 MB or smaller" });
      }
      return res.status(400).json({ error: err.message || "Invalid image upload" });
    }
    return sendUploadedImage(req, res);
  });
}

module.exports = { uploadCommunityImage };
