const Redis = require("ioredis");

let _shared = null;

/**
 * BullMQ-compatible Redis connection (must not use maxRetriesPerRequest: 3 default for blocking ops).
 */
const createRedisConnection = () => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
};

/** Singleton for app + worker in same process. */
const getSharedRedis = () => {
  if (!_shared) _shared = createRedisConnection();
  return _shared;
};

module.exports = {
  createRedisConnection,
  getSharedRedis,
};
