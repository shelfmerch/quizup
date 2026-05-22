export { useBattleController, type BattleControllerConfig } from "./hooks/useBattleController";
export { battleReducer } from "./reducers/battleReducer";
export { createInitialBattleState } from "./reducers/initialState";
export { PHASE_TRANSITIONS, canHandleEvent } from "./state-machine/transitions";
export type {
  BattleCoreState,
  BattlePhase,
  BattleViewState,
  MatchResultData,
  RoundResult,
} from "./types";
export type { BattleEvent, BattleEventType } from "./types/events";
export type { OnlineBattleSession } from "./types/session";
export { BATTLE_CLIENT_EVENTS, BATTLE_SERVER_EVENTS } from "./socket/battleSocketEvents";
export {
  getRoundRemainingMs,
  getRoundRemainingSec,
  isRoundExpired,
} from "./timers/roundClock";
