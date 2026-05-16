const { S3Client } = require("@aws-sdk/client-s3");

/** Strip surrounding quotes from .env values (e.g. AWS_ACCESS_KEY="AKIA..."). */
function stripEnv(v) {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

const REGION = stripEnv(process.env.AWS_REGION) || "ap-south-1";
const BUCKET = stripEnv(process.env.S3_BUCKET_NAME);
/** Optional CloudFront or custom CDN base, e.g. https://cdn.example.com */
const PUBLIC_BASE = stripEnv(process.env.S3_PUBLIC_BASE_URL);

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: stripEnv(process.env.AWS_ACCESS_KEY),
    secretAccessKey: stripEnv(process.env.AWS_SECRET_ACCESS_KEY),
  },
});

/** Public URL for an object key (no leading slash). */
function getPublicUrl(key) {
  const k = String(key).replace(/^\/+/, "");
  if (PUBLIC_BASE) {
    return `${PUBLIC_BASE.replace(/\/+$/, "")}/${k}`;
  }
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${k}`;
}

function getBucketHost() {
  return `${BUCKET}.s3.${REGION}.amazonaws.com`;
}

function isOurS3Url(url) {
  if (!url || typeof url !== "string" || !BUCKET) return false;
  try {
    const u = new URL(url.trim());
    if (PUBLIC_BASE) {
      return u.hostname === new URL(PUBLIC_BASE).hostname;
    }
    return u.hostname === getBucketHost();
  } catch {
    return false;
  }
}

/**
 * Map API path `/uploads/food/x.png` → S3 key `uploads/food/x.png`
 * Map `/uploads/avatars/x.jpg` → `avatars/x.jpg`
 */
function localPathToS3Key(localPath) {
  const p = String(localPath).trim().replace(/^\/+/, "");
  if (!p.startsWith("uploads/")) return null;
  const rel = p.slice("uploads/".length);
  if (!rel || rel.includes("..")) return null;
  return rel.startsWith("avatars/") ? rel : `uploads/${rel}`;
}

/** Resolve stored refs (legacy `/uploads/...` or https) to a browser-loadable URL. */
function resolveStoredMediaUrl(stored) {
  if (stored == null) return null;
  const s = String(stored).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("/uploads/") && BUCKET) {
    const key = localPathToS3Key(s);
    if (key) return getPublicUrl(key);
  }
  return s;
}

function validateS3Config() {
  const missing = [];
  if (!stripEnv(process.env.AWS_ACCESS_KEY)) missing.push("AWS_ACCESS_KEY");
  if (!stripEnv(process.env.AWS_SECRET_ACCESS_KEY)) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!BUCKET) missing.push("S3_BUCKET_NAME");
  if (missing.length) {
    console.warn(`[S3] Missing: ${missing.join(", ")} — media uploads will fail until configured`);
    return false;
  }
  console.log(`[S3] Media storage: s3://${BUCKET} (${REGION})`);
  return true;
}

module.exports = {
  s3,
  BUCKET,
  REGION,
  stripEnv,
  getPublicUrl,
  getBucketHost,
  isOurS3Url,
  localPathToS3Key,
  resolveStoredMediaUrl,
  validateS3Config,
};
