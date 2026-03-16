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
  sessionId?: string;
}

export interface LobbyAssignedPayload {
  playerId: string;
  slot: number;
}

export interface LobbyPlayer {
  playerId: string;
  slot: number;
  ready: boolean;
}

export interface LobbyStatePayload {
  players: LobbyPlayer[];
  gameStarted: boolean;
}
