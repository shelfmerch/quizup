const { Worker } = require("bullmq");
const { createRedisConnection } = require("../queue/redis");
const { QUEUE_NAME } = require("../queue/questionPipelineQueue");
const { processQuestionPipelineJob } = require("../jobs/processQuestionPipelineJob");
const { getModelCandidates } = require("../services/geminiService");

let workerInstance = null;

/**
 * Single worker instance per Node process (guards duplicate PM2 / require cycles).
 * @returns {import("bullmq").Worker | null}
 */
const startQuestionPipelineWorker = () => {
  if (workerInstance) {
    console.warn("[QuestionPipelineWorker] already started in this process — ignoring duplicate start");
    return workerInstance;
  }
  if (!process.env.REDIS_URL) {
    console.warn("[QuestionPipelineWorker] REDIS_URL missing — worker not started");
    return null;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[QuestionPipelineWorker] GEMINI_API_KEY missing — worker not started");
    return null;
  }

  const connection = createRedisConnection("bullmq-worker");

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== "generate-batch") {
        throw new Error(`Unknown job name: ${job.name}`);
      }
      return processQuestionPipelineJob(job.data);
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 300_000,
      stalledInterval: 60_000,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[QuestionPipelineWorker] completed ${job.id}`, result);
  });
  worker.on("failed", (job, err) => {
    console.error(`[QuestionPipelineWorker] failed ${job?.id}`, err?.message || err);
  });
  worker.on("error", (err) => {
    console.error("[QuestionPipelineWorker] worker error:", err?.message || err);
  });
  worker.on("stalled", (jobId) => {
    console.warn("[QuestionPipelineWorker] stalled job:", jobId);
  });

  console.log("[QuestionPipelineWorker] listening on queue", QUEUE_NAME);
  console.log("[QuestionPipelineWorker] Gemini model chain:", getModelCandidates().join(" → "));

  workerInstance = worker;
  return worker;
};

const closeQuestionPipelineWorker = async () => {
  if (!workerInstance) return;
  try {
    await workerInstance.close();
    console.log("[QuestionPipelineWorker] closed");
  } catch (e) {
    console.error("[QuestionPipelineWorker] close error:", e?.message || e);
  } finally {
    workerInstance = null;
  }
};

module.exports = {
  startQuestionPipelineWorker,
  closeQuestionPipelineWorker,
};
