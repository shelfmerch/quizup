/**
 * One-off patcher:
 * Some seeded celebrity questions referenced `/uploads/name-the-celebrity-seed/*.png`
 * but the intended files exist under `/uploads/avatars/*.jpg`.
 *
 * This script updates Question.imageUrl from the old paths to the avatar paths,
 * so the S3 migration script can then replace them with S3 URLs.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const Question = require("../models/Question");

const MAP = {
  "/uploads/name-the-celebrity-seed/draupadi-murmu.png": "/uploads/avatars/draupadi_murmu.jpg",
  "/uploads/name-the-celebrity-seed/botez-sisters.png": "/uploads/avatars/botez_sisters.jpg",
  "/uploads/name-the-celebrity-seed/arijit-singh.png": "/uploads/avatars/arajit_singh.jpg",
  "/uploads/name-the-celebrity-seed/dr-israr-ahmed.png": "/uploads/avatars/dr_israar.jpg",
  "/uploads/name-the-celebrity-seed/ariana-grande.png": "/uploads/avatars/ariana_grande.jpg",
  "/uploads/name-the-celebrity-seed/hamza-ali-abbasi.png": "/uploads/avatars/hamza_ali_abbasi.jpg",
  "/uploads/name-the-celebrity-seed/dua-lipa.png": "/uploads/avatars/dua_lipa.jpg",
  "/uploads/name-the-celebrity-seed/joey-tribbiani.png": "/uploads/avatars/joey_tribbiani.jpg",
  "/uploads/name-the-celebrity-seed/fatima-sana-shaikh.png": "/uploads/avatars/fatima.jpg",
  "/uploads/name-the-celebrity-seed/light-yagami.png": "/uploads/avatars/light_yagami.jpg",
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  let total = 0;
  for (const [from, to] of Object.entries(MAP)) {
    const res = await Question.updateMany({ imageUrl: from }, { $set: { imageUrl: to } });
    if (res.modifiedCount) {
      console.log(`${from} -> ${to} (patched ${res.modifiedCount})`);
      total += res.modifiedCount;
    }
  }

  console.log(`Patched questions: ${total}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Patch failed:", err);
  process.exit(1);
});

