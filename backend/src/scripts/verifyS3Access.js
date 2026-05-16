/**
 * Quick check that AWS credentials can write to the configured bucket.
 * Run: node src/scripts/verifyS3Access.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, REGION, getPublicUrl } = require("../config/s3");

async function main() {
  if (!BUCKET) throw new Error("S3_BUCKET_NAME is not set");
  const key = `_healthcheck/migrate-test-${Date.now()}.txt`;
  const body = Buffer.from("quizup-s3-ok");

  console.log(`Testing s3:PutObject on s3://${BUCKET}/${key} (${REGION})…`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    })
  );
  console.log("✅  PutObject succeeded");
  console.log(`    Public URL: ${getPublicUrl(key)}`);

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log("✅  Test object deleted");
}

main().catch((err) => {
  console.error("\n❌  S3 access check failed:");
  console.error(`    ${err.message}`);
  if (/not authorized|AccessDenied/i.test(err.message)) {
    console.error("\nAttach an IAM policy that allows s3:PutObject and s3:DeleteObject on:");
    console.error(`    arn:aws:s3:::${BUCKET}`);
    console.error(`    arn:aws:s3:::${BUCKET}/*`);
  }
  process.exit(1);
});
