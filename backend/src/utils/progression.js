const INITIAL_XP_TO_LEVEL = 1000;
const XP_LEVEL_MULTIPLIER = 1.4;

function xpThresholdToAdvance(fromLevel) {
  const start = Math.max(1, Math.floor(fromLevel) || 1);
  let threshold = INITIAL_XP_TO_LEVEL;
  for (let l = 1; l < start; l++) {
    threshold = Math.floor(threshold * XP_LEVEL_MULTIPLIER);
  }
  return threshold;
}

/** Minimum cumulative `users.xp` required to be at `level`. */
function cumulativeXpForLevel(levelRaw) {
  const level =
    typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpThresholdToAdvance(l);
  }
  return total;
}

/** XP still needed to reach `level + 1` from cumulative `xp`. */
function xpRemainingToNextLevel(xpRaw, levelRaw) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  const level =
    typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  return Math.max(0, cumulativeXpForLevel(level + 1) - xp);
}

/** Progress through the current level band (0–100). */
function levelProgressPercent(xpRaw, levelRaw) {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  const level =
    typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  const start = cumulativeXpForLevel(level);
  const end = cumulativeXpForLevel(level + 1);
  const span = end - start;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((xp - start) / span) * 100));
}

/**
 * One-time conversion from legacy bar XP (reset on level-up) to cumulative `users.xp`.
 */
function legacyBarXpToCumulative(levelRaw, barXpRaw) {
  const level =
    typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  const barXp =
    typeof barXpRaw === "number" && Number.isFinite(barXpRaw) ? Math.max(0, Math.floor(barXpRaw)) : 0;
  return cumulativeXpForLevel(level) + barXp;
}

module.exports = {
  INITIAL_XP_TO_LEVEL,
  XP_LEVEL_MULTIPLIER,
  xpThresholdToAdvance,
  cumulativeXpForLevel,
  xpRemainingToNextLevel,
  levelProgressPercent,
  legacyBarXpToCumulative,
};
