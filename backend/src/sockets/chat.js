const ChatMessage = require("../models/ChatMessage");

module.exports = function registerChat(socket, io) {
  socket.on("chat:join", async ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    socket.join(roomId);

    try {
      const rows = await ChatMessage.find({ roomId }).sort({ createdAt: -1 }).limit(50).lean();
      const history = rows
        .reverse()
        .map((m) => ({
          id: m._id.toString(),
          roomId: m.roomId,
          senderId: m.senderId,
          senderName: m.senderName,
          senderAvatar: m.senderAvatar,
          text: m.text,
          createdAt: m.createdAt,
        }));
      socket.emit("chat:history", { roomId, messages: history });
    } catch (err) {
      console.error("[Chat] history error:", err);
    }
  });

  socket.on("chat:leave", ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    socket.leave(roomId);
  });

  socket.on("chat:send", async ({ roomId, text }) => {
    const t = String(text || "").trim();
    if (!roomId || typeof roomId !== "string") return;
    if (!t) return;

    try {
      const doc = await ChatMessage.create({
        roomId,
        senderId: socket.userId,
        senderName: socket.username,
        senderAvatar: socket.avatarUrl || "",
        text: t,
      });

      const msg = {
        id: doc._id.toString(),
        roomId,
        senderId: socket.userId,
        senderName: socket.username,
        senderAvatar: socket.avatarUrl || "",
        text: t,
        createdAt: doc.createdAt,
      };

      io.to(roomId).emit("chat:message", msg);

      const parts = roomId.split(":");
      if (parts.length === 2) {
        const recipientId = parts[0] === socket.userId ? parts[1] : parts[0];
        io.to(`user:${recipientId}`).emit("chat:inbox", {
          roomId,
          fromUserId: socket.userId,
        });
      }
    } catch (err) {
      console.error("[Chat] send error:", err);
      socket.emit("chat:error", { message: "Failed to send message" });
    }
  });
};
