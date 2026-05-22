import type { MatchPlayer } from "@/types";

export interface OnlineBattleSession {
  matchId: string;
  mySeat: "player1" | "player2";
  myUserId: string;
  opponentUserId: string;
  me: MatchPlayer;
  opponent: MatchPlayer;
  categoryId: string;
  categoryName: string;
  totalRounds: number;
}
