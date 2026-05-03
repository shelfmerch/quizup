const { Worker } = require("bullmq");
const { createRedisConnection } = require("../queue/redis");
const { QUEUE_NAME } = require("../queue/questionPipelineQueue");
const { processQuestionPipelineJob } = require("../jobs/processQuestionPipelineJob");

/**
 * @returns {import("bullmq").Worker | null}
 */
const startQuestionPipelineWorker = () => {
  if (!process.env.REDIS_URL) {
    console.warn("[QuestionPipelineWorker] REDIS_URL missing — worker not started");
    return null;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[QuestionPipelineWorker] GEMINI_API_KEY missing — worker not started");
    return null;
  }

  const connection = createRedisConnection();

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
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[QuestionPipelineWorker] completed ${job.id}`, result);
  });
  worker.on("failed", (job, err) => {
    console.error(`[QuestionPipelineWorker] failed ${job?.id}`, err?.message || err);
  });

  console.log("[QuestionPipelineWorker] listening on queue", QUEUE_NAME);
  return worker;
};

module.exports = { startQuestionPipelineWorker };
