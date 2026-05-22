import { useMemo } from "react";
import type { Match } from "@/types";
import { useBattleController } from "@/battle";

/**
 * Offline / simulated battle — server events replaced by local orchestration.
 * @see useBattleController
 */
export const useBattle = (match: Match | null) => {
  const config = useMemo(
    () => (match ? ({ mode: "local" as const, match }) : null),
    [match?.id]
  );

  const { state, startNextRound, submitAnswer, proceedToNext, getWinner } =
    useBattleController(config);

  return { state, startNextRound, submitAnswer, proceedToNext, getWinner };
};
