const crypto = require("crypto");
const User = require("../models/User");
const Category = require("../models/Category");
const { createDirectMatch, getActiveMatch } = require("../services/matchmakingService");

/**
 * In-memory pending challenges (clears on server restart).
 * challenge = { id, fromUserId, fromUsername, fromAvatarUrl, toUserId, toUsername, categoryId, categoryName, createdAt }
 */
const challengesById = new Map();
const incomingIdsByUser = new Map(); // userId -> Set(challengeId)
const outgoingIdsByUser = new Map(); // userId -> Set(challengeId)

function _getSet(map, key) {
  let s = map.get(key);
  if (!s) {
    s = new Set();
    map.set(key, s);
  }
  return s;
}

function _removeChallenge(challengeId) {
  const ch = challengesById.get(challengeId);
  if (!ch) return null;
  challengesById.delete(challengeId);
  _getSet(incomingIdsByUser, ch.toUserId).delete(challengeId);
  _getSet(outgoingIdsByUser, ch.fromUserId).delete(challengeId);
  return ch;
}

function _serializeChallenge(ch) {
  return {
    id: ch.id,
    from: { userId: ch.fromUserId, username: ch.fromUsername, avatarUrl: ch.fromAvatarUrl || "" },
    to: { userId: ch.toUserId, username: ch.toUsername },
    categoryId: ch.categoryId,
    categoryName: ch.categoryName,
    createdAt: ch.createdAt,
  };
}

function _clientQuestions(match) {
  return (match.questions || []).map(({ correctIndex: _drop, ...q }) => q);
}

function _matchFoundPayload(matchId, state, myUserId) {
  const isP1 = state.player1.userId === myUserId;
  const opp = isP1 ? state.player2 : state.player1;
  return {
    matchId,
    categoryId: state.categoryId,
    categoryName: state.categoryName,
    totalRounds: (state.questions || []).length,
    questions: _clientQuestions(state),
    myUserId,
    mySeat: isP1 ? "player1" : "player2",
    opponent: {
      userId: opp.userId,
      username: opp.username || opp.userId,
      avatarUrl: opp.avatarUrl || "",
      level: opp.level || 1,
    },
  };
}

module.exports = function registerChallenge(socket, io) {
  // List pending challenges for the logged-in user
  socket.on("challenge:list", async () => {
    const incomingIds = Array.from(_getSet(incomingIdsByUser, socket.userId));
    const outgoingIds = Array.from(_getSet(outgoingIdsByUser, socket.userId));
    const incoming = incomingIds.map((id) => challengesById.get(id)).filter(Boolean).map(_serializeChallenge);
    const outgoing = outgoingIds.map((id) => challengesById.get(id)).filter(Boolean).map(_serializeChallenge);
    socket.emit("challenge:list", { incoming, outgoing });
  });

  // Send a challenge to another user by id or username
  socket.on("challenge:send", async ({ toUserId, toUsername, categoryId } = {}) => {
    try {
      const catId = String(categoryId || "").trim() || "science";

      let targetId = toUserId ? String(toUserId) : null;
      let targetUser = null;
      if (!targetId) {
        const uname = String(toUsername || "").trim();
        if (!uname) return socket.emit("challenge:error", { message: "toUsername or toUserId is required" });
        targetUser = await User.findOne({ username: new RegExp(`^${uname}$`, "i") }).lean();
        if (!targetUser) return socket.emit("challenge:error", { message: "User not found" });
        targetId = targetUser._id.toString();
      } else {
        targetUser = await User.findById(targetId).lean();
        if (!targetUser) return socket.emit("challenge:error", { message: "User not found" });
      }

      if (targetId === socket.userId) return socket.emit("challenge:error", { message: "You can't challenge yourself" });

      const category = await Category.findOne({ slug: catId }).lean();
      const categoryName = category ? category.name : catId;

      // avoid duplicate pending between same pair+category
      const outgoing = _getSet(outgoingIdsByUser, socket.userId);
      for (const id of outgoing) {
        const existing = challengesById.get(id);
        if (existing && existing.toUserId === targetId && existing.categoryId === catId) {
          return socket.emit("challenge:error", { message: "Challenge already pending" });
        }
      }

      const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
      const ch = {
        id,
        fromUserId: socket.userId,
        fromUsername: socket.username,
        fromAvatarUrl: socket.avatarUrl || "",
        toUserId: targetId,
        toUsername: targetUser.username,
        categoryId: catId,
        categoryName,
        createdAt: new Date().toISOString(),
      };

      challengesById.set(id, ch);
      _getSet(outgoingIdsByUser, socket.userId).add(id);
      _getSet(incomingIdsByUser, targetId).add(id);

      socket.emit("challenge:sent", _serializeChallenge(ch));
      io.to(`user:${targetId}`).emit("challenge:received", _serializeChallenge(ch));
    } catch (err) {
      console.error("[Challenge] send error:", err);
      socket.emit("challenge:error", { message: "Failed to send challenge" });
    }
  });

  // Cancel an outgoing challenge
  socket.on("challenge:cancel", ({ challengeId } = {}) => {
    const id = String(challengeId || "");
    const ch = challengesById.get(id);
    if (!ch) return;
    if (ch.fromUserId !== socket.userId) return;
    _removeChallenge(id);
    socket.emit("challenge:cancelled", { challengeId: id });
    io.to(`user:${ch.toUserId}`).emit("challenge:cancelled", { challengeId: id });
  });

  // Accept or reject an incoming challenge
  socket.on("challenge:respond", async ({ challengeId, action } = {}) => {
    const id = String(challengeId || "");
    const act = String(action || "");
    const ch = challengesById.get(id);
    if (!ch) return socket.emit("challenge:error", { message: "Challenge not found" });
    if (ch.toUserId !== socket.userId) return socket.emit("challenge:error", { message: "Not authorized" });
    if (act !== "accept" && act !== "reject") return socket.emit("challenge:error", { message: "Invalid action" });

    _removeChallenge(id);

    if (act === "reject") {
      io.to(`user:${ch.fromUserId}`).emit("challenge:result", { challengeId: id, status: "rejected" });
      io.to(`user:${ch.toUserId}`).emit("challenge:result", { challengeId: id, status: "rejected" });
      return;
    }

    try {
      const { matchId } = await createDirectMatch(ch.fromUserId, ch.toUserId, ch.categoryId);
      const stateMatch = await getActiveMatch(matchId);
      if (!stateMatch) throw new Error("Match missing after creation");

      // Notify both clients that the challenge was accepted
      io.to(`user:${ch.fromUserId}`).emit("challenge:result", { challengeId: id, status: "accepted", matchId });
      io.to(`user:${ch.toUserId}`).emit("challenge:result", { challengeId: id, status: "accepted", matchId });

      // Reuse the existing frontend flow by emitting the standard `match_found`
      io.to(`user:${ch.fromUserId}`).emit("match_found", _matchFoundPayload(matchId, stateMatch, ch.fromUserId));
      io.to(`user:${ch.toUserId}`).emit("match_found", _matchFoundPayload(matchId, stateMatch, ch.toUserId));
    } catch (err) {
      console.error("[Challenge] accept error:", err);
      socket.emit("challenge:error", { message: "Failed to start match" });
    }
  });
};

