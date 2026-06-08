const { getChallengeById, serializeChallenge } = require("../sockets/challenge");
const onlinePresence = require("../state/onlinePresence");

/**
 * GET /api/challenges/:challengeId
 * Returns challenge details for the authenticated participant.
 */
const getChallenge = (req, res) => {
  const ch = getChallengeById(req.params.challengeId);
  if (!ch) {
    return res.status(404).json({ error: "Challenge not found or expired" });
  }

  const userId = req.user._id.toString();
  if (ch.fromUserId !== userId && ch.toUserId !== userId) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const serialized = serializeChallenge(ch);
  res.json({
    ...serialized,
    fromOnline: onlinePresence.isOnline(ch.fromUserId),
    toOnline: onlinePresence.isOnline(ch.toUserId),
  });
};

module.exports = { getChallenge };
