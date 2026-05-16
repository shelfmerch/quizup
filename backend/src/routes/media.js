const express = require("express");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, parseS3KeyFromUrl } = require("../config/s3");

const router = express.Router();

/**
 * Stream a private S3 object to the browser (bucket blocks public GetObject).
 * GET /api/media/file/migrated/abc.jpg
 */
router.use("/file", async (req, res) => {
  try {
    if (!BUCKET) return res.status(503).json({ error: "Media storage not configured" });

    const key = decodeURIComponent(req.path.replace(/^\//, ""));
    if (!key || key.includes("..")) {
      return res.status(400).json({ error: "Invalid media key" });
    }

    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const contentType = obj.ContentType || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    if (obj.ETag) res.setHeader("ETag", obj.ETag);

    const body = obj.Body;
    if (!body) return res.status(404).end();
    if (typeof body.pipe === "function") {
      body.pipe(res);
      return;
    }
    const chunks = [];
    for await (const chunk of body) chunks.push(chunk);
    res.send(Buffer.concat(chunks));
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: "Not found" });
    }
    console.error("[Media] S3 stream error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load media" });
  }
});

module.exports = router;
