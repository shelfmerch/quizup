/**
 * Shared in-memory online-presence tracker.
 * Centralises the per-user socket count so every module that needs
 * "is user X online?" can use the same source of truth.
 */

const onlineCountByUser = new Map(); // userId -> number of active sockets

function incrOnline(userId) {
  const prev = onlineCountByUser.get(userId) || 0;
  onlineCountByUser.set(userId, prev + 1);
  return prev === 0; // true when user just came online (was 0 -> 1)
}

function decrOnline(userId) {
  const next = (onlineCountByUser.get(userId) || 0) - 1;
  if (next <= 0) {
    onlineCountByUser.delete(userId);
    return true; // user went offline
  }
  onlineCountByUser.set(userId, next);
  return false; // still has other sockets open
}

function isOnline(userId) {
  return (onlineCountByUser.get(userId) || 0) > 0;
}

/** Check online status of multiple user IDs at once. Returns { [userId]: boolean } */
function checkMany(userIds) {
  const result = {};
  for (const id of userIds) {
    result[id] = isOnline(id);
  }
  return result;
}

module.exports = { incrOnline, decrOnline, isOnline, checkMany };
