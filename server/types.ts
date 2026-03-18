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
  | { type: "summonHero"; playerId: string; barrackId: string; heroTypeId: string }
  | { type: "repairBarrack"; playerId: string; barrackId: string }
  | { type: "castCastleSpell"; playerId: string; castleId: string }
  | {
      type: "setBarrackRoute";
      playerId: string;
      barrackId: string;
      waypoints: { x: number; y: number }[];
    }
  | { type: "setAutoDevelopmentEnabled"; playerId: string; enabled: boolean };

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
