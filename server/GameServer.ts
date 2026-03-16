import { Server as HttpServer } from "http";
import { Server as SocketServer, type Socket } from "socket.io";
import { Game } from "../lib/game-engine/core/Game";
import { defaultGameConfig } from "../lib/game-engine/config/defaultConfig";
import type { GameStateSnapshotSerialized } from "../lib/game-engine/core/Game";
import { ServerGameLoop } from "./ServerGameLoop";
import type { GameAction } from "./types";

const ROOM_ID = "game-room";
const PLAYER_IDS = ["player-1", "player-2", "player-3", "player-4"];
const GAME_START_DELAY_MS = 3000;

export class GameServer {
  private readonly io: SocketServer;
  private readonly game: Game;
  private readonly loop: ServerGameLoop;
  private readonly humanPlayerIds = new Set<string>();
  private gameStarted = false;

  constructor(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: "*" },
    });
    this.game = new Game(defaultGameConfig);
    this.game.setHumanPlayerIds(this.humanPlayerIds);
    this.loop = new ServerGameLoop((deltaTimeMs) => this.onTick(deltaTimeMs));

    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    socket.on("lobby:join", (payload?: { playerSlot?: number }) => {
      const slot = this.assignPlayer(socket, payload?.playerSlot);
      if (slot !== -1) {
        socket.emit("lobby:assigned", { playerId: PLAYER_IDS[slot], slot });
        this.humanPlayerIds.add(PLAYER_IDS[slot]);
        this.game.setHumanPlayerIds(this.humanPlayerIds);
        socket.join(ROOM_ID);
        (socket as Socket & { playerId?: string }).playerId = PLAYER_IDS[slot];

        const snapshot = this.game.getStateSnapshot() as GameStateSnapshotSerialized;
        socket.emit("game:state", snapshot);

        if (!this.gameStarted) {
          this.gameStarted = true;
          setTimeout(() => {
            this.game.setSpawningEnabled(true);
            this.loop.start();
          }, GAME_START_DELAY_MS);
        }
      }
    });

    socket.on("game:action", (action: GameAction) => {
      this.handleAction(socket, action);
    });

    socket.on("disconnect", () => {
      const playerId = (socket as Socket & { playerId?: string }).playerId;
      if (playerId) {
        this.humanPlayerIds.delete(playerId);
        this.game.setHumanPlayerIds(this.humanPlayerIds);
      }
    });
  }

  private assignPlayer(socket: Socket, preferredSlot?: number): number {
    const usedSlots = new Set<number>();
    for (const [, s] of this.io.sockets.sockets) {
      const pid = (s as Socket & { playerId?: string }).playerId;
      if (pid) {
        const idx = PLAYER_IDS.indexOf(pid);
        if (idx >= 0) usedSlots.add(idx);
      }
    }
    if (preferredSlot !== undefined && preferredSlot >= 0 && preferredSlot < 4 && !usedSlots.has(preferredSlot)) {
      return preferredSlot;
    }
    for (let i = 0; i < 4; i++) {
      if (!usedSlots.has(i)) return i;
    }
    return -1;
  }

  private handleAction(socket: Socket, action: GameAction): void {
    const playerId = (socket as Socket & { playerId?: string }).playerId;
    if (!playerId || action.playerId !== playerId) return;

    switch (action.type) {
      case "buyUpgrade":
        this.game.buyUpgrade(action.playerId, action.upgradeId);
        break;
      case "buyBarrackUpgrade":
        this.game.buyBarrackUpgrade(action.playerId, action.barrackId, action.upgradeId);
        break;
      case "buyBarrackWarrior":
        this.game.buyBarrackWarrior(action.playerId, action.barrackId);
        break;
      case "repairBarrack":
        this.game.repairBarrack(action.playerId, action.barrackId);
        break;
      case "setBarrackRoute":
        this.game.setBarrackRoute(action.barrackId, action.waypoints);
        break;
    }
  }

  private onTick(deltaTimeMs: number): void {
    this.game.update(deltaTimeMs);
    const snapshot = this.game.getStateSnapshot() as GameStateSnapshotSerialized;
    this.io.to(ROOM_ID).emit("game:state", snapshot);
    if (snapshot.gameOver) {
      this.loop.stop();
    }
  }
}
