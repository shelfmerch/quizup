require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const categoryRoutes = require("./routes/categories");
const leaderboardRoutes = require("./routes/leaderboard");
const matchRoutes = require("./routes/matches");
const adminRoutes = require("./routes/admin");
const followRoutes = require("./routes/follow");
const chatRoutes = require("./routes/chat");

const app = express();

const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL,
      process.env.FRONTEND_URL,
      ...extraOrigins,
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:8081",
    ].filter(Boolean),
    credentials: true,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── Public files (admin-uploaded question images) ─────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  const readyState = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
  const db =
    readyState === 1 ? "connected" : readyState === 2 ? "connecting" : readyState === 3 ? "disconnecting" : "disconnected";
  res.json({ status: "ok", db, ts: Date.now() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/chat", chatRoutes);

// ─── Production: serve Vite build (same port as API + Socket.io) ────────────
// Repo structure: /root/quizup/backend/src/app.js → frontend build lives at /root/quizup/dist
const distPath = path.join(__dirname, "..", "..", "dist");
const distIndex = path.join(distPath, "index.html");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { fallthrough: true }));
}

// SPA fallback (do not swallow API routes)
app.get("*", (req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next();
  }

  if (!fs.existsSync(distIndex)) {
    return next();
  }

  res.sendFile(distIndex, (err) => {
    // If the file disappeared between the existsSync check and sendFile's stat,
    // fall through to the 404 handler instead of crashing the request.
    if (err) return next();
  });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[Express] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
