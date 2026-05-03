const {
  getActiveMatch,
  updateActiveMatch,
  getUserCurrentMatch,
  recordPlayerJoinedRoom,
} = require("../services/matchmakingService");
const battlePresence = require("../state/battlePresence");
const {
  startMatch,
  handleAnswer,
  handlePlayerDisconnect,
  cancelDisconnectTimer,
  finalizeMatch,
} = require("../services/battleEngine");

/**
 * Battle socket event handlers.
 *
 * Events received:
 *   join_match_room   { matchId }
 *   submit_answer     { matchId, selectedIndex }
 *   reconnect_match   {}   (no payload — server looks up by userId)
 *
 * Events emitted:
 *   room_joined       { matchId, currentState }
 *   battle_start      { matchId }
 *   question_start    { questionIndex, totalQuestions, question, timerEndsAt }
 *   answer_result     { isCorrect, pointsEarned, correctIndex }
 *   round_end         { correctIndex, player1Score, player2Score, roundAnswers }
 *   match_end         { matchId, winnerId, player1, player2, endReason }
 *   opponent_disconnected  { userId, graceMs }
 *   match_abandoned   { matchId }
 *   battle_error      { message }
 */
const registerBattle = (socket, io) => {
  // ── join_match_room ────────────────────────────────────────────────────────
  socket.on("join_match_room", async ({ matchId } = {}) => {
    if (!matchId) {
      return socket.emit("battle_error", { message: "matchId is required" });
    }

    try {
      const state = await getActiveMatch(matchId);
      if (!state) {
        return socket.emit("battle_error", { message: "Match not found or already ended" });
      }

      // Verify this socket's user belongs to this match
      const isP1 = state.player1.userId === socket.userId;
      const isP2 = state.player2.userId === socket.userId;
      if (!isP1 && !isP2) {
        return socket.emit("battle_error", { message: "You are not a participant in this match" });
      }

      // Update socketId + connectedPlayers atomically (avoids lost-update when both players join at once)
      const freshState = await recordPlayerJoinedRoom(
        matchId,
        socket.userId,
        isP1,
        socket.id
      );
      if (!freshState) {
        return socket.emit("battle_error", { message: "Match not found" });
      }

      // Join the Socket.io room
      socket.join(matchId);
      socket.currentMatchId = matchId;
      battlePresence.setUserMatch(socket.userId, matchId);

      // Send current state back to the joining player (useful for reconnect)
      socket.emit("room_joined", {
        matchId,
        status: freshState.status,
        currentQuestionIndex: freshState.currentQuestionIndex,
        player1Score: freshState.player1.score,
        player2Score: freshState.player2.score,
      });

      console.log(`[Battle] ${socket.username} joined room ${matchId}`);

      // If game is already in progress (reconnect scenario), catch them up
      if (freshState.status === "in_progress") {
        cancelDisconnectTimer(matchId, socket.userId);
        io.to(socket.id).emit("battle_start", { matchId });
        // Resend the current question if there is one
        if (freshState.currentQuestionIndex >= 0) {
          const q = freshState.questions[freshState.currentQuestionIndex];
          socket.emit("question_start", {
            questionIndex: freshState.currentQuestionIndex,
            totalQuestions: freshState.questions.length,
            question: {
              id: q.id,
              text: q.text,
              options: q.options,
              timeLimit: q.timeLimit,
              imageUrl: q.imageUrl || null,
              questionType: q.questionType || (q.imageUrl ? "IMAGE" : "TEXT"),
              isBonusRound: Boolean(q.isBonusRound),
              pointsMultiplier: q.pointsMultiplier != null ? q.pointsMultiplier : q.isBonusRound ? 2 : 1,
            },
            timerEndsAt: freshState.timerEndsAt,
          });
        }
        return;
      }

      // Check if BOTH players are now connected
      const bothConnected =
        freshState.connectedPlayers.includes(freshState.player1.userId) &&
        freshState.connectedPlayers.includes(freshState.player2.userId);

      if (bothConnected && freshState.status === "waiting") {
        console.log(`[Battle] Both players in room ${matchId} — starting match`);
        await startMatch(matchId, io);
      }
    } catch (err) {
      console.error("[Battle] join_match_room error:", err);
      socket.emit("battle_error", { message: "Failed to join match room" });
    }
  });

  // ── submit_answer ─────────────────────────────────────────────────────────
  socket.on("submit_answer", async ({ matchId, selectedIndex } = {}) => {
    if (!matchId || selectedIndex === undefined || selectedIndex === null) {
      return socket.emit("battle_error", { message: "matchId and selectedIndex are required" });
    }
    if (typeof selectedIndex !== "number" || selectedIndex < 0 || selectedIndex > 3) {
      return socket.emit("battle_error", { message: "selectedIndex must be 0–3" });
    }

    try {
      await handleAnswer(matchId, socket.userId, selectedIndex, io);
    } catch (err) {
      console.error("[Battle] submit_answer error:", err);
      socket.emit("battle_error", { message: "Failed to process answer" });
    }
  });

  // ── reconnect_match ───────────────────────────────────────────────────────
  socket.on("reconnect_match", async () => {
    try {
      const matchId = await getUserCurrentMatch(socket.userId);
      if (!matchId) {
        return socket.emit("battle_error", { message: "No active match to reconnect to" });
      }
      // Re-use join_match_room logic
      socket.emit("join_match_room", { matchId });
      socket.emit("reconnecting_to", { matchId });
    } catch (err) {
      console.error("[Battle] reconnect_match error:", err);
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    battlePresence.clearUser(socket.userId);
    const matchId = socket.currentMatchId;
    if (!matchId) return;

    try {
      const state = await getActiveMatch(matchId);
      if (!state || state.status !== "in_progress") return;

      // Remove from connected list
      await updateActiveMatch(matchId, (s) => ({
        ...s,
        connectedPlayers: (s.connectedPlayers || []).filter((id) => id !== socket.userId),
      }));

      console.log(`[Battle] ${socket.username} disconnected from match ${matchId} — starting grace period`);
      await handlePlayerDisconnect(matchId, socket.userId, io);
    } catch (err) {
      console.error("[Battle] disconnect error:", err);
    }
  });
};

module.exports = registerBattle;
