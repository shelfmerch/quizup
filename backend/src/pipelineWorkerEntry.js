/**
 * Standalone BullMQ consumer for the question pipeline.
 * Run with: node src/pipelineWorkerEntry.js
 * PM2: see ecosystem.config.cjs (quizup-pipeline-worker).
 */
require("dotenv").config();
const connectDB = require("./config/db");
const { startQuestionPipelineWorker, closeQuestionPipelineWorker } = require("./workers/questionPipelineWorker");

const main = async () => {
  console.log("[PipelineWorkerEntry] starting (PID %s)", process.pid);
  connectDB();

  const worker = startQuestionPipelineWorker();
  if (!worker) {
    console.error("[PipelineWorkerEntry] worker did not start (check REDIS_URL, GEMINI_API_KEY)");
    process.exit(1);
  }

  const shutdown = async (signal) => {
    console.log(`[PipelineWorkerEntry] ${signal} — shutting down`);
    await closeQuestionPipelineWorker();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

main().catch((e) => {
  console.error("[PipelineWorkerEntry] fatal:", e);
  process.exit(1);
});
