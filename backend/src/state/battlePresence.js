/**
 * Tracks which match room a user is currently in (authoritative = join_match_room).
 * This avoids treating "online" or stale DB rows as "in a live match".
 *
 * In-memory only (clears on restart).
 */

const matchIdByUser = new Map(); // userId -> matchId

function setUserMatch(userId, matchId) {
  if (!userId || !matchId) return;
  matchIdByUser.set(String(userId), String(matchId));
}

function clearUser(userId) {
  if (!userId) return;
  matchIdByUser.delete(String(userId));
}

function getUserMatch(userId) {
  if (!userId) return null;
  return matchIdByUser.get(String(userId)) || null;
}

module.exports = {
  setUserMatch,
  clearUser,
  getUserMatch,
};

