import { useEffect, useState } from "react";
import type { BattlePhase } from "../types";

const TICK_MS = 250;

/**
 * Lightweight clock tick — updates a counter only during `question` phase.
 * Game state stays in the reducer; this hook exists purely for render cadence.
 */
export function useRoundClockTick(
  phase: BattlePhase | undefined,
  roundKey: number
): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (phase !== "question") return;
    setTick(0);
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, roundKey]);

  return tick;
}
