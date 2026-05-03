const Redis = require("ioredis");

let _shared = null;

const attachRedisLogging = (conn, label) => {
  conn.on("error", (err) => {
    console.error(`[Redis:${label}] error:`, err?.message || err);
  });
  conn.on("close", () => {
    console.warn(`[Redis:${label}] connection closed`);
  });
  conn.on("reconnecting", (delay) => {
    console.warn(`[Redis:${label}] reconnecting in ${delay}ms`);
  });
};

/**
 * BullMQ-compatible Redis connection (must not use maxRetriesPerRequest: 3 default for blocking ops).
 * @param {string} [label="default"]
 */
const createRedisConnection = (label = "default") => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  const conn = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  attachRedisLogging(conn, label);
  return conn;
};

/** Singleton for API process (Queue). Worker uses its own connection via createRedisConnection. */
const getSharedRedis = () => {
  if (!_shared) _shared = createRedisConnection("queue-shared");
  return _shared;
};

module.exports = {
  createRedisConnection,
  getSharedRedis,
};
