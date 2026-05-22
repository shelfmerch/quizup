const {
  joinQueue,
  leaveQueue,
  leaveAllQueues,
  getActiveMatch,
} = require("../services/matchmakingService");
const MatchQueue = require("../models/MatchQueue");
const User = require("../models/User");
const Category = require("../models/Category");

/**
 * Matchmaking socket event handlers.
 *
 * Events received:
 *   join_queue          { categoryId }
 *   leave_queue         { categoryId }
 *   queue:get_searching  (no payload)
 *
 * Events emitted:
 *   queued               { categoryId }              — confirmed in queue
 *   match_found          { matchId, opponent, categoryId, categoryName, totalRounds, questions }
 *   queue_error          { message }
 *   queue:searching_users { users: [...] }
 */
const registerMatchmaking = (socket, io) => {
  // ── join_queue ────────────────────────────────────────────────────────────
  socket.on("join_queue", async ({ categoryId } = {}) => {
    if (!categoryId) {
      return socket.emit("queue_error", { message: "categoryId is required" });
    }

    console.log(`[Matchmaking] ${socket.username} joining queue: ${categoryId}`);

    try {
      const result = await joinQueue(socket.userId, categoryId, socket.id);

      if (result.alreadyQueued) {
        return socket.emit("queue_error", { message: "Already in a queue" });
      }

      if (!result.matched) {
        // Waiting for opponent
        return socket.emit("queued", { categoryId });
      }

      // Match found — notify both players
      const { matchId, match } = result;

      // Strip correctIndex from questions before sending to clients
      const clientQuestions = match.questions.map(({ correctIndex: _drop, ...q }) => q);

      const p1Payload = {
        matchId,
        categoryId: match.categoryId,
        categoryName: match.categoryName,
        totalRounds: match.questions.length,
        questions: clientQuestions,
        opponent: {
          userId: match.player2.userId,
          username: match.player2.socketId === socket.id ? match.player1.username : match.player2.username,
          avatarUrl: match.player2.socketId === socket.id ? match.player1.avatarUrl : match.player2.avatarUrl,
          level: match.player2.socketId === socket.id ? match.player1 : match.player2,
        },
      };

      // Build correct payloads for each player
      const p1 = match.player1;
      const p2 = match.player2;

      const p1MatchPayload = {
        matchId,
        categoryId: match.categoryId,
        categoryName: match.categoryName,
        totalRounds: match.questions.length,
        questions: clientQuestions,
        myUserId: p1.userId,
        opponent: { userId: p2.userId, username: p2.socketId ? _getUsername(match, p2.userId) : p2.userId, avatarUrl: p2.avatarUrl || "" },
      };

      const p2MatchPayload = {
        matchId,
        categoryId: match.categoryId,
        categoryName: match.categoryName,
        totalRounds: match.questions.length,
        questions: clientQuestions,
        myUserId: p2.userId,
        opponent: { userId: p1.userId, username: p1.socketId ? _getUsername(match, p1.userId) : p1.userId, avatarUrl: p1.avatarUrl || "" },
      };

      // Fetch fresh usernames from the match state (stored during creation)
      const stateMatch = await getActiveMatch(matchId);

      const finalP1Payload = buildMatchFoundPayload(matchId, stateMatch, stateMatch.player1.userId, clientQuestions);
      const finalP2Payload = buildMatchFoundPayload(matchId, stateMatch, stateMatch.player2.userId, clientQuestions);

      io.to(result.player1SocketId).emit("match_found", finalP1Payload);
      io.to(result.player2SocketId).emit("match_found", finalP2Payload);

      console.log(`[Matchmaking] Match ${matchId} found: ${stateMatch.player1.userId} vs ${stateMatch.player2.userId}`);
    } catch (err) {
      console.error("[Matchmaking] join_queue error:", err);
      socket.emit("queue_error", { message: "Matchmaking error, please try again" });
    }
  });

  // ── queue:get_searching — return real players in the matchmaking queue ───
  socket.on("queue:get_searching", async () => {
    try {
      // Fetch all queue entries except the requesting user, newest first
      const queueEntries = await MatchQueue.find({ userId: { $ne: socket.userId } })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      if (queueEntries.length === 0) {
        return socket.emit("queue:searching_users", { users: [] });
      }

      // Populate user info
      const userIds = queueEntries.map((q) => q.userId);
      const users = await User.find({ _id: { $in: userIds } }).lean();
      const userMap = {};
      users.forEach((u) => { userMap[u._id.toString()] = u; });

      // Populate category names
      const catSlugs = [...new Set(queueEntries.map((q) => q.categoryId))];
      const categories = await Category.find({ slug: { $in: catSlugs } }).lean();
      const catMap = {};
      categories.forEach((c) => {
        catMap[c.slug] = { name: c.name, icon: c.icon || "" };
      });

      const result = queueEntries
        .map((q) => {
          const u = userMap[q.userId.toString()];
          if (!u) return null;
          const cat = catMap[q.categoryId];
          return {
            userId: u._id.toString(),
            username: u.username,
            avatarUrl: u.avatarUrl || "",
            level: u.level || 1,
            categoryId: q.categoryId,
            categoryName: cat?.name || q.categoryId,
            categoryIcon: cat?.icon || "",
            queuedAt: q.createdAt,
          };
        })
        .filter(Boolean);

      socket.emit("queue:searching_users", { users: result });
    } catch (err) {
      console.error("[Matchmaking] queue:get_searching error:", err);
      socket.emit("queue:searching_users", { users: [] });
    }
  });

  // ── leave_queue ───────────────────────────────────────────────────────────
  socket.on("leave_queue", async ({ categoryId } = {}) => {
    try {
      if (categoryId) {
        await leaveQueue(socket.userId, categoryId);
      } else {
        await leaveAllQueues(socket.userId);
      }
      socket.emit("left_queue", { categoryId });
      console.log(`[Matchmaking] ${socket.username} left queue: ${categoryId || "all"}`);
    } catch (err) {
      console.error("[Matchmaking] leave_queue error:", err);
    }
  });

  // ── disconnect cleanup ────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    try {
      await leaveAllQueues(socket.userId);
    } catch (err) {
      console.error("[Matchmaking] disconnect cleanup error:", err);
    }
  });
};

/**
 * Build the match_found payload for a specific player's perspective.
 */
const buildMatchFoundPayload = (matchId, state, myUserId, clientQuestions) => {
  const isP1 = state.player1.userId === myUserId;
  const me = isP1 ? state.player1 : state.player2;
  const opp = isP1 ? state.player2 : state.player1;

  return {
    matchId,
    categoryId: state.categoryId,
    categoryName: state.categoryName,
    totalRounds: state.questions.length,
    questions: clientQuestions,
    myUserId,
    /** Server seat for score mapping: player1 joined second (matched), player2 was waiting. */
    mySeat: isP1 ? "player1" : "player2",
    opponent: {
      userId: opp.userId,
      username: opp.username || opp.userId,
      avatarUrl: opp.avatarUrl || "",
      level: opp.level || 1,
    },
  };
};

// Helper to get username from state
const _getUsername = (state, userId) => {
  if (state.player1.userId === userId) return state.player1.username || userId;
  return state.player2.username || userId;
};

module.exports = registerMatchmaking;
