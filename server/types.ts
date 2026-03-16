/** Экшены, которые клиент отправляет на сервер. */
export type GameAction =
  | { type: "buyUpgrade"; playerId: string; upgradeId: string }
  | {
      type: "buyBarrackUpgrade";
      playerId: string;
      barrackId: string;
      upgradeId: string;
    }
  | { type: "buyBarrackWarrior"; playerId: string; barrackId: string }
  | { type: "repairBarrack"; playerId: string; barrackId: string }
  | {
      type: "setBarrackRoute";
      playerId: string;
      barrackId: string;
      waypoints: { x: number; y: number }[];
    };

export interface LobbyJoinPayload {
  playerSlot?: number;
}

export interface LobbyAssignedPayload {
  playerId: string;
  slot: number;
}
