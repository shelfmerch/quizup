/**
 * Optional one-time migration: convert legacy bar XP (reset on level-up) to cumulative users.xp.
 *
 *   node src/scripts/migrate-legacy-bar-xp.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { legacyBarXpToCumulative, xpRemainingToNextLevel } = require("../utils/progression");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({});
  let updated = 0;

  for (const user of users) {
    const cumulative = legacyBarXpToCumulative(user.level, user.xp);
    if (cumulative === user.xp) continue;
    user.xp = cumulative;
    user.xpToNextLevel = xpRemainingToNextLevel(user.xp, user.level);
    await user.save();
    updated += 1;
    console.log(`${user.username}: xp → ${cumulative}, level ${user.level}`);
  }

  console.log(`Done. Updated ${updated} / ${users.length} users.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
