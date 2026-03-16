import { Server as HttpServer } from "http";
import { Server as SocketServer, type Socket } from "socket.io";
import { Game } from "../lib/game-engine/core/Game";
import { defaultGameConfig } from "../lib/game-engine/config/defaultConfig";
import type { GameStateSnapshotSerialized } from "../lib/game-engine/core/Game";
import { ServerGameLoop } from "./ServerGameLoop";
import type { GameAction, LobbyStatePayload } from "./types";

const ROOM_ID = "game-room";
const PLAYER_IDS = ["player-1", "player-2", "player-3", "player-4"];

export class GameServer {
  private readonly io: SocketServer;
  private readonly game: Game;
  private readonly loop: ServerGameLoop;
  private readonly humanPlayerIds = new Set<string>();
  private readonly readyPlayers = new Set<string>();
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
        const playerId = PLAYER_IDS[slot];
        socket.emit("lobby:assigned", { playerId, slot });
        this.humanPlayerIds.add(playerId);
        this.game.setHumanPlayerIds(this.humanPlayerIds);
        socket.join(ROOM_ID);
        (socket as Socket & { playerId?: string }).playerId = playerId;

        const snapshot = this.game.getStateSnapshot() as GameStateSnapshotSerialized;
        socket.emit("game:state", snapshot);

        this.broadcastLobbyState();
      }
    });

    socket.on("lobby:ready", () => {
      const playerId = (socket as Socket & { playerId?: string }).playerId;
      if (playerId && this.humanPlayerIds.has(playerId)) {
        this.readyPlayers.add(playerId);
        this.broadcastLobbyState();
        this.tryStartGame();
      }
    });

    socket.on("game:action", (action: GameAction) => {
      this.handleAction(socket, action);
    });

    socket.on("disconnect", () => {
      const playerId = (socket as Socket & { playerId?: string }).playerId;
      if (playerId) {
        this.humanPlayerIds.delete(playerId);
        this.readyPlayers.delete(playerId);
        this.game.setHumanPlayerIds(this.humanPlayerIds);
        this.broadcastLobbyState();
      }
    });
  }

  private getLobbyState(): LobbyStatePayload {
    const players: LobbyStatePayload["players"] = [];
    for (const [s, sock] of this.io.sockets.sockets) {
      const pid = (sock as Socket & { playerId?: string }).playerId;
      if (pid) {
        const slot = PLAYER_IDS.indexOf(pid);
        if (slot >= 0) {
          players.push({
            playerId: pid,
            slot,
            ready: this.readyPlayers.has(pid),
          });
        }
      }
    }
    players.sort((a, b) => a.slot - b.slot);
    return { players, gameStarted: this.gameStarted };
  }

  private broadcastLobbyState(): void {
    const state = this.getLobbyState();
    this.io.to(ROOM_ID).emit("lobby:state", state);
  }

  private tryStartGame(): void {
    if (this.gameStarted) return;
    const connectedCount = this.humanPlayerIds.size;
    if (connectedCount === 0) return;
    const readyCount = this.readyPlayers.size;
    if (readyCount >= connectedCount) {
      this.gameStarted = true;
      this.game.setSpawningEnabled(true);
      this.loop.start();
      this.io.to(ROOM_ID).emit("game:start");
    }
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
