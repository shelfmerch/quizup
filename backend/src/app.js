require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const categoryRoutes = require("./routes/categories");
const leaderboardRoutes = require("./routes/leaderboard");
const matchRoutes = require("./routes/matches");
const adminRoutes = require("./routes/admin");
const followRoutes = require("./routes/follow");

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [process.env.CLIENT_URL, process.env.FRONTEND_URL, "http://localhost:5173", "http://localhost:8080", "http://localhost:8081"].filter(Boolean),
    credentials: true,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── Public files (admin-uploaded question images) ─────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/follow", followRoutes);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[Express] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
