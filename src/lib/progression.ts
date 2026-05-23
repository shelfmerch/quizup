/** XP required to advance from `fromLevel` → `fromLevel + 1` (matches User.addXP). */
export const INITIAL_XP_TO_LEVEL = 1000;
export const XP_LEVEL_MULTIPLIER = 1.4;

export function xpThresholdToAdvance(fromLevel: number): number {
  const start = Math.max(1, Math.floor(fromLevel) || 1);
  let threshold = INITIAL_XP_TO_LEVEL;
  for (let l = 1; l < start; l++) {
    threshold = Math.floor(threshold * XP_LEVEL_MULTIPLIER);
  }
  return threshold;
}

/** Minimum cumulative `users.xp` required to be at `level`. */
export function cumulativeXpForLevel(levelRaw: unknown): number {
  const level = typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpThresholdToAdvance(l);
  }
  return total;
}

/** XP still needed to reach the next level. */
export function xpRemainingToNextLevel(xpRaw: unknown, levelRaw: unknown): number {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  const level = typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  return Math.max(0, cumulativeXpForLevel(level + 1) - xp);
}

/** Progress through the current level band (0–100). */
export function levelProgressPercent(xpRaw: unknown, levelRaw: unknown): number {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  const level = typeof levelRaw === "number" && Number.isFinite(levelRaw) ? Math.max(1, Math.floor(levelRaw)) : 1;
  const start = cumulativeXpForLevel(level);
  const end = cumulativeXpForLevel(level + 1);
  const span = end - start;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, ((xp - start) / span) * 100));
}

export type LeagueKey =
  | "unranked"
  | "bronze"
  | "silver"
  | "gold"
  | "crystal"
  | "master"
  | "champion"
  | "titan"
  | "legend";

export interface League {
  key: LeagueKey;
  name: string;
  minXpInclusive: number;
  badgeUrl: string;
}

/** Highest league whose XP threshold is met (`users.xp`). */
export const LEAGUES: League[] = [
  { key: "legend", name: "Legend", minXpInclusive: 20000, badgeUrl: "/leagues/legend.svg" },
  { key: "titan", name: "Titan", minXpInclusive: 15000, badgeUrl: "/leagues/titan.png" },
  { key: "champion", name: "Champion", minXpInclusive: 13000, badgeUrl: "/leagues/champion.png" },
  { key: "master", name: "Master", minXpInclusive: 10000, badgeUrl: "/leagues/master.png" },
  { key: "crystal", name: "Crystal", minXpInclusive: 7000, badgeUrl: "/leagues/crystal.png" },
  { key: "gold", name: "Gold", minXpInclusive: 5000, badgeUrl: "/leagues/gold.png" },
  { key: "silver", name: "Silver", minXpInclusive: 2000, badgeUrl: "/leagues/silver.png" },
  { key: "bronze", name: "Bronze", minXpInclusive: 1000, badgeUrl: "/leagues/bronze.png" },
  { key: "unranked", name: "Unranked", minXpInclusive: 0, badgeUrl: "/leagues/unranked.png" },
];

export function getLeagueFromXp(xpRaw: unknown): League {
  const xp = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.max(0, Math.floor(xpRaw)) : 0;
  for (const league of LEAGUES) {
    if (xp >= league.minXpInclusive) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

export function leagueBadgeSrc(badgeUrl: string): string {
  const path = badgeUrl.startsWith("/") ? badgeUrl.slice(1) : badgeUrl;
  return `${import.meta.env.BASE_URL || "/"}${path}`;
}
