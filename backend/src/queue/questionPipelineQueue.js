const { Queue } = require("bullmq");
const { getSharedRedis } = require("./redis");

const QUEUE_NAME = "question-pipeline";

const _envBatch = Number(process.env.QUESTION_PIPELINE_BATCH_SIZE);
/** Max questions per BullMQ job (hard cap 5 for Gemini rate limits). */
const BATCH_SIZE = Number.isFinite(_envBatch) && _envBatch >= 1 ? Math.min(5, Math.floor(_envBatch)) : 5;

let _queue = null;

const getQuestionPipelineQueue = () => {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: getSharedRedis(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
      },
    });
    _queue.on("error", (err) => {
      console.error("[QuestionPipelineQueue] error:", err?.message || err);
    });
  }
  return _queue;
};

/**
 * Split count into jobs of up to BATCH_SIZE.
 * @param {{ categoryId: string, count: number }} payload
 * @returns {Promise<{ jobIds: string[], batches: number }>}
 */
const enqueueQuestionGeneration = async ({ categoryId, count }) => {
  const queue = getQuestionPipelineQueue();
  const total = Math.min(500, Math.max(1, Math.floor(Number(count) || 0)));
  const jobs = [];
  let remaining = total;
  while (remaining > 0) {
    const size = Math.min(BATCH_SIZE, remaining);
    const job = await queue.add(
      "generate-batch",
      { categoryId: String(categoryId).trim().toLowerCase(), batchSize: size },
      { jobId: `${categoryId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}` }
    );
    jobs.push(job.id);
    remaining -= size;
  }
  return { jobIds: jobs, batches: jobs.length };
};

module.exports = {
  QUEUE_NAME,
  BATCH_SIZE,
  getQuestionPipelineQueue,
  enqueueQuestionGeneration,
};
