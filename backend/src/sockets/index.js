const { Server } = require("socket.io");
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const registerMatchmaking = require("./matchmaking");
const registerBattle = require("./battle");
const registerChat = require("./chat");

/**
 * Initialize Socket.io on the HTTP server.
 * All sockets must authenticate via JWT in the handshake.
 */
const initSockets = (httpServer) => {
  const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    ...extraOrigins,
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : true,
      credentials: true,
    },
    // Use websocket first, fallback to polling
    transports: ["websocket", "polling"],
  });

  // ─── Auth middleware ──────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("MISSING_TOKEN"));
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error("INVALID_TOKEN"));
    }

    const user = await User.findById(payload.sub).lean();
    if (!user) {
      return next(new Error("USER_NOT_FOUND"));
    }

    // Attach user info to socket for use in handlers
    socket.userId = user._id.toString();
    socket.username = user.username;
    socket.avatarUrl = user.avatarUrl;
    socket.userLevel = user.level;

    next();
  });

  // ─── Connection handler ───────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.username} (${socket.id})`);

    socket.join(`user:${socket.userId}`);

    // Register feature-specific handlers
    registerMatchmaking(socket, io);
    registerBattle(socket, io);
    registerChat(socket, io);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${socket.username} — ${reason}`);
    });
  });

  return io;
};

module.exports = initSockets;
