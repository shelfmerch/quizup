require("dotenv").config();
const http = require("http");
const connectDB = require("./config/db");
const app = require("./app");
const initSockets = require("./sockets");

const PORT = process.env.PORT || 3001;

const start = async () => {
  // 1. Create HTTP server from Express app
  const server = http.createServer(app);

  // 1b. Background workers (BullMQ) — same process as API for simpler ops
  try {
    const { startQuestionPipelineWorker } = require("./workers/questionPipelineWorker");
    startQuestionPipelineWorker();
  } catch (e) {
    console.warn("[Server] Question pipeline worker failed to start:", e.message);
  }

  // 2. Attach Socket.io to the same HTTP server
  initSockets(server);

  // 3. Listen (do this even if Mongo is temporarily down)
  server.listen(PORT, () => {
    console.log(`[Server] QuizUp backend running on http://localhost:${PORT}`);
    console.log(`[Server] Socket.io attached`);
    console.log(`[Server] Env: ${process.env.NODE_ENV || "development"}`);
  });

  // 4. Connect MongoDB (retry loop lives inside connectDB)
  connectDB();

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Server] SIGTERM received — shutting down");
    server.close(() => process.exit(0));
  });
};

start();
