const mongoose = require("mongoose");

// Simple chat message model (created lazily to avoid circular deps)
let ChatMessage;
function getChatMessageModel() {
  if (ChatMessage) return ChatMessage;
  const schema = new mongoose.Schema(
    {
      roomId: { type: String, index: true, required: true },
      senderId: { type: String, required: true },
      senderName: { type: String, required: true },
      senderAvatar: { type: String, default: "" },
      text: { type: String, required: true, maxlength: 1000 },
    },
    { timestamps: { createdAt: "createdAt", updatedAt: false } }
  );
  ChatMessage = mongoose.models.ChatMessage || mongoose.model("ChatMessage", schema);
  return ChatMessage;
}

module.exports = function registerChat(socket, io) {
  socket.on("chat:join", async ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    socket.join(roomId);

    try {
      const Model = getChatMessageModel();
      const rows = await Model.find({ roomId }).sort({ createdAt: -1 }).limit(50).lean();
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
      // If history fails, still allow live chat.
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
      const Model = getChatMessageModel();
      const doc = await Model.create({
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
    } catch (err) {
      console.error("[Chat] send error:", err);
      socket.emit("chat:error", { message: "Failed to send message" });
    }
  });
};

