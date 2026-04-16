const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const Category = require("../models/Category");

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URL;
  if (!uri) throw new Error("Missing Mongo URI env (expected MONGODB_URI)");
  await mongoose.connect(uri);
  const c = await Category.findOne({ slug: "food" }).lean();
  console.log("food questionCount:", c?.questionCount);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

