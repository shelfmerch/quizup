/**
 * Timestamp-based round clock — immune to setInterval drift and tab throttling.
 * UI reads remaining ms/seconds from server `roundEndTimestamp` only.
 */

export function getRoundRemainingMs(roundEndTimestamp: number | null, now = Date.now()): number {
  if (roundEndTimestamp == null) return 0;
  return Math.max(0, roundEndTimestamp - now);
}

export function getRoundRemainingSec(roundEndTimestamp: number | null, now = Date.now()): number {
  return Math.ceil(getRoundRemainingMs(roundEndTimestamp, now) / 1000);
}

export function getRoundPercentRemaining(
  roundEndTimestamp: number | null,
  timeLimitSec: number,
  now = Date.now()
): number {
  if (!roundEndTimestamp || timeLimitSec <= 0) return 0;
  const totalMs = timeLimitSec * 1000;
  const remaining = getRoundRemainingMs(roundEndTimestamp, now);
  return Math.max(0, Math.min(100, (remaining / totalMs) * 100));
}

export function isRoundExpired(roundEndTimestamp: number | null, now = Date.now()): boolean {
  return roundEndTimestamp != null && now >= roundEndTimestamp;
}
