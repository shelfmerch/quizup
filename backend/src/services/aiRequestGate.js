/**
 * Global serial gate for ALL Gemini (and any wrapped) calls.
 * Prevents parallel AI requests — one completes before the next starts.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getInterCallDelayMs = () => {
  const n = Number(process.env.GEMINI_INTER_CALL_DELAY_MS);
  if (Number.isFinite(n) && n >= 0) return n;
  return 1500;
};

/** @type {Promise<void>} */
let tail = Promise.resolve();

/**
 * Run `fn` strictly after all prior gated calls finish. Adds a fixed delay before `fn`.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
const runSerialized = async (fn) => {
  const delayMs = getInterCallDelayMs();
  const job = tail.then(async () => {
    if (delayMs > 0) await sleep(delayMs);
    return fn();
  });
  tail = job.then(
    () => {},
    () => {}
  );
  return job;
};

module.exports = {
  runSerialized,
  getInterCallDelayMs,
};
