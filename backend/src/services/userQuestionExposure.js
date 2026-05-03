const User = require("../models/User");

const CAP = 500;

/**
 * Remember which question ids a user has seen so matchmaking can deprioritize/exclude them.
 * @param {string} userId
 * @param {{ id?: string }[]} questions
 */
const recordMatchQuestionExposure = async (userId, questions) => {
  const ids = (questions || []).map((q) => q.id).filter(Boolean);
  if (!ids.length) return;
  await User.updateOne(
    { _id: userId },
    { $push: { lastPlayedQuestionIds: { $each: ids, $slice: -CAP } } }
  );
};

/**
 * @param {string} userIdA
 * @param {string} userIdB
 * @returns {Promise<Set<string>>}
 */
const getRecentQuestionIdSetForTwoUsers = async (userIdA, userIdB) => {
  const [u1, u2] = await Promise.all([
    User.findById(userIdA).select("lastPlayedQuestionIds").lean(),
    User.findById(userIdB).select("lastPlayedQuestionIds").lean(),
  ]);
  const set = new Set();
  for (const id of u1?.lastPlayedQuestionIds || []) set.add(String(id));
  for (const id of u2?.lastPlayedQuestionIds || []) set.add(String(id));
  return set;
};

module.exports = {
  recordMatchQuestionExposure,
  getRecentQuestionIdSetForTwoUsers,
};
