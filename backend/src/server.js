require("dotenv").config();
const http = require("http");
const connectDB = require("./config/db");
const { validateS3Config } = require("./config/s3");
const app = require("./app");
const initSockets = require("./sockets");

const PORT = process.env.PORT || 3003;

const start = async () => {
  validateS3Config();

  // 1. Create HTTP server from Express app
  const server = http.createServer(app);

  // 1b. Optional embedded pipeline worker (default: off in production — use pipelineWorkerEntry + PM2)
  if (process.env.RUN_EMBEDDED_PIPELINE_WORKER === "true") {
    try {
      const { startQuestionPipelineWorker } = require("./workers/questionPipelineWorker");
      startQuestionPipelineWorker();
      console.log("[Server] Embedded question pipeline worker enabled (RUN_EMBEDDED_PIPELINE_WORKER=true)");
    } catch (e) {
      console.warn("[Server] Embedded pipeline worker failed to start:", e.message);
    }
  } else {
    console.log(
      "[Server] Pipeline worker not embedded. Run `node src/pipelineWorkerEntry.js` or PM2 app `quizup-pipeline-worker` (see ecosystem.config.cjs)."
    );
  }

  // 2. Attach Socket.io to the same HTTP server (exposed for REST-triggered realtime events)
  const io = initSockets(server);
  app.set("io", io);

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
