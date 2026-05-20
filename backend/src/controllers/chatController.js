const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const ChatReadState = require("../models/ChatReadState");
const User = require("../models/User");

function roomIdForUsers(uid1, uid2) {
  return [String(uid1), String(uid2)].sort().join(":");
}

function lastMessagePreview(msg, myUserId) {
  if (!msg) return "";
  const fromMe = msg.senderId === myUserId;
  const prefix = fromMe ? "You: " : "";
  if (msg.text) return prefix + msg.text;
  if ((msg.mediaType || "").startsWith("video")) {
    return fromMe ? "You sent a video" : "Video";
  }
  if (msg.mediaUrl) return fromMe ? "You sent a photo" : "Photo";
  return "Message";
}

// GET /api/chat/unread-summary
const getUnreadSummary = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const allRooms = await ChatMessage.distinct("roomId");
    const myRooms = allRooms.filter((r) => typeof r === "string" && r.split(":").includes(userId));

    const items = [];
    const peerIds = [];
    for (const roomId of myRooms) {
      const parts = roomId.split(":");
      if (parts.length !== 2) continue;
      const peerId = parts[0] === userId ? parts[1] : parts[0];
      if (!mongoose.Types.ObjectId.isValid(peerId)) continue;

      const read = await ChatReadState.findOne({ userId: req.user._id, roomId }).lean();
      const lastReadAt = read?.lastReadAt ? new Date(read.lastReadAt) : new Date(0);

      const unreadCount = await ChatMessage.countDocuments({
        roomId,
        senderId: { $ne: userId },
        createdAt: { $gt: lastReadAt },
      });

      if (unreadCount === 0) continue;

      peerIds.push(peerId);
      items.push({ roomId, peerId, unreadCount });
    }

    const peers = await User.find({ _id: { $in: peerIds } })
      .select("username displayName avatarUrl")
      .lean();

    const peerMap = new Map(peers.map((p) => [p._id.toString(), p]));

    const result = items.map((row) => {
      const p = peerMap.get(row.peerId);
      return {
        roomId: row.roomId,
        peerId: row.peerId,
        unreadCount: row.unreadCount,
        username: p?.username || "User",
        displayName: p?.displayName || p?.username || "User",
        avatarUrl: p?.avatarUrl || "",
      };
    });

    result.sort((a, b) => b.unreadCount - a.unreadCount);

    const totalUnread = result.reduce((s, x) => s + x.unreadCount, 0);
    return res.json({ items: result, totalUnread });
  } catch (err) {
    console.error("[Chat] getUnreadSummary error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// PUT /api/chat/read  body: { peerId: string }
const markRead = async (req, res) => {
  try {
    const { peerId } = req.body || {};
    if (!peerId || typeof peerId !== "string" || !mongoose.Types.ObjectId.isValid(peerId)) {
      return res.status(400).json({ error: "Invalid peerId" });
    }
    const me = req.user._id.toString();
    if (peerId === me) return res.status(400).json({ error: "Invalid peer" });

    const roomId = roomIdForUsers(me, peerId);
    await ChatReadState.findOneAndUpdate(
      { userId: req.user._id, roomId },
      { $set: { lastReadAt: new Date() } },
      { upsert: true, new: true }
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Chat] markRead error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// GET /api/chat/conversations — inbox list (unread first, then by last activity)
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const allRooms = await ChatMessage.distinct("roomId");
    const myRooms = allRooms.filter((r) => typeof r === "string" && r.split(":").includes(userId));

    const rows = [];
    const peerIds = [];

    for (const roomId of myRooms) {
      const parts = roomId.split(":");
      if (parts.length !== 2) continue;
      const peerId = parts[0] === userId ? parts[1] : parts[0];
      if (!mongoose.Types.ObjectId.isValid(peerId)) continue;

      const lastMsg = await ChatMessage.findOne({ roomId }).sort({ createdAt: -1 }).lean();
      if (!lastMsg) continue;

      const read = await ChatReadState.findOne({ userId: req.user._id, roomId }).lean();
      const lastReadAt = read?.lastReadAt ? new Date(read.lastReadAt) : new Date(0);

      const unreadCount = await ChatMessage.countDocuments({
        roomId,
        senderId: { $ne: userId },
        createdAt: { $gt: lastReadAt },
      });

      peerIds.push(peerId);
      rows.push({
        roomId,
        peerId,
        unreadCount,
        lastMessageAt: lastMsg.createdAt,
        lastMessagePreview: lastMessagePreview(lastMsg, userId),
        lastMessageFromMe: lastMsg.senderId === userId,
      });
    }

    const peers = await User.find({ _id: { $in: peerIds } })
      .select("username displayName avatarUrl")
      .lean();
    const peerMap = new Map(peers.map((p) => [p._id.toString(), p]));

    const conversations = rows.map((row) => {
      const p = peerMap.get(row.peerId);
      return {
        roomId: row.roomId,
        peerId: row.peerId,
        unreadCount: row.unreadCount,
        lastMessageAt: row.lastMessageAt,
        lastMessagePreview: row.lastMessagePreview,
        lastMessageFromMe: row.lastMessageFromMe,
        username: p?.username || "User",
        displayName: p?.displayName || p?.username || "User",
        avatarUrl: p?.avatarUrl || "",
      };
    });

    conversations.sort((a, b) => {
      const aUnread = a.unreadCount > 0;
      const bUnread = b.unreadCount > 0;
      if (aUnread !== bUnread) return aUnread ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    const totalUnread = conversations.reduce((s, x) => s + x.unreadCount, 0);
    return res.json({ conversations, totalUnread });
  } catch (err) {
    console.error("[Chat] getConversations error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getUnreadSummary, markRead, getConversations };
