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

/** Lifetime XP (bar XP + completed level thresholds). */
function computeTotalXp(levelRaw, barXpRaw) {
  const level =
    typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  const barXp =
    typeof barXpRaw === "number" && Number.isFinite(barXpRaw) ? Math.max(0, Math.floor(barXpRaw)) : 0;
  let total = barXp;
  for (let l = 1; l < level; l++) {
    total += xpThresholdToAdvance(l);
  }
  return total;
}

module.exports = {
  INITIAL_XP_TO_LEVEL,
  XP_LEVEL_MULTIPLIER,
  xpThresholdToAdvance,
  computeTotalXp,
};
