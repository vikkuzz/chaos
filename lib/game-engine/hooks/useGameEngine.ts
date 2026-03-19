"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, type Socket } from "socket.io-client";
import { Game } from "../core/Game";
import type { GameConfig } from "../config/defaultConfig";
import { GameLoop } from "../core/GameLoop";
import {
  CanvasRenderer,
  type ViewportState,
} from "../renderer/CanvasRenderer";
import type { GameStateSnapshot, EntitySnapshot } from "../core/Game";
import {
  getVisionSources,
  computeVisibleCells,
  updateLastKnownEnemies,
  FOG_CELL_SIZE,
} from "../fog/FogOfWar";

export type GameEngineMode = "local" | "multiplayer";

export interface UseGameEngineOptions {
  mode?: GameEngineMode;
  socketUrl?: string;
  /** При mode=multiplayer — сокет и состояние от useMultiplayerSocket (после game:start). */
  multiplayerSocket?: Socket;
  multiplayerPlayerId?: string | null;
  multiplayerGameState?: GameStateSnapshot | null;
  /** При mode=local — ID игрока-человека (выбранный в UI). Для авторазвития: при отключении не тратит только он. */
  localHumanPlayerId?: string | null;
  /** Включить туман войны (чёрный + серый). По умолчанию true. */
  fogOfWarEnabled?: boolean;
}

export interface ExtraBuilding {
  id: string;
  kind: "barrack" | "tower";
  ownerId: string;
  position: { x: number; y: number };
}

export interface StoredNeutralPoint {
  id: string;
  position: { x: number; y: number };
  radius: number;
  captureRadius: number;
  goldPerInterval: number;
  goldIntervalMs: number;
}

export interface UseGameEngineResult {
  game: Game | null;
  state: GameStateSnapshot | null;
  playerId: string | null;
  setBarrackRoute: (barrackId: string, waypoints: { x: number; y: number }[]) => void;
  setBuildingPosition: (entityId: string, position: { x: number; y: number }) => void;
  addBarrack: (playerId: string, position: { x: number; y: number }) => string | null;
  addTower: (playerId: string, position: { x: number; y: number }) => string | null;
  addNeutralPoint: (position: { x: number; y: number }, options?: Partial<StoredNeutralPoint>) => string | null;
  removeNeutralPoint: (id: string) => boolean;
  buyCastleUpgrade: (playerId: string, trackId: import("../core/Game").CastleUpgradeTrack) => boolean;
  buyBarrackUpgrade: (playerId: string, barrackId: string) => boolean;
  buyBarrackWarrior: (playerId: string, barrackId: string) => boolean;
  repairBarrack: (playerId: string, barrackId: string) => boolean;
  castCastleSpell: (playerId: string, castleId: string, spellIndex?: 0 | 1) => boolean;
  summonHero: (playerId: string, barrackId: string, heroTypeId: string) => boolean;
  setSpawningEnabled: (enabled: boolean) => void;
  setAutoDevelopmentEnabled: (enabled: boolean) => void;
  isAutoDevelopmentEnabled: () => boolean;
  setFogOfWarEnabled: (enabled: boolean) => void;
  isFogOfWarEnabled: () => boolean;
}

const EXTRA_BUILDINGS_KEY = "rts-extra-buildings";
const NEUTRAL_POINTS_KEY = "rts-neutral-points";

/**
 * Инициализирует Game, GameLoop и CanvasRenderer, привязывая их к canvasRef.
 * viewportRef: ref с актуальным viewport (pan, zoom, size). Если задан, canvas
 * ресайзится под viewport и рендер использует pan/zoom.
 * mode: 'local' — локальная игра; 'multiplayer' — подключение к серверу по сокетам.
 */
export function useGameEngine(
  canvasRef: RefObject<HTMLCanvasElement>,
  config: GameConfig,
  viewportRef?: RefObject<ViewportState | null>,
  options?: UseGameEngineOptions,
): UseGameEngineResult {
  const mode = options?.mode ?? "local";
  const socketUrl = options?.socketUrl ?? process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
  const multiplayerSocket = options?.multiplayerSocket;
  const multiplayerPlayerId = options?.multiplayerPlayerId;
  const multiplayerGameState = options?.multiplayerGameState;
  const localHumanPlayerId = options?.localHumanPlayerId;
  const fogOfWarEnabledRef = useRef(options?.fogOfWarEnabled ?? true);
  fogOfWarEnabledRef.current = options?.fogOfWarEnabled ?? true;

  const revealedCellsRef = useRef<Set<string>>(new Set());
  const lastKnownEnemiesRef = useRef<Map<string, EntitySnapshot>>(new Map());

  const [game, setGame] = useState<Game | null>(null);
  const [state, setState] = useState<GameStateSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const gameRef = useRef<Game | null>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef<GameStateSnapshot | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const currentPlayerIdRef = useRef<string | null>(null);
  playerIdRef.current = multiplayerPlayerId ?? playerId;
  currentPlayerIdRef.current = mode === "multiplayer" ? multiplayerPlayerId ?? null : localHumanPlayerId ?? null;

  useEffect(() => {
    if (multiplayerGameState !== undefined) {
      stateRef.current = multiplayerGameState;
      setState(multiplayerGameState);
    }
  }, [multiplayerGameState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mode === "multiplayer" && multiplayerSocket && multiplayerPlayerId) {
      socketRef.current = multiplayerSocket;
      playerIdRef.current = multiplayerPlayerId;
      stateRef.current = multiplayerGameState ?? null;
      setState(multiplayerGameState ?? null);
      setPlayerId(multiplayerPlayerId);

      const playerColors = Object.fromEntries(config.players.map((p) => [p.id, p.color]));
      const renderer = new CanvasRenderer(canvas, { showRoutes: true, playerColors });
      rendererRef.current = renderer;

      let rafId: number;
      const renderLoop = () => {
        const vp = viewportRef?.current;
        const st = stateRef.current;
        if (st && canvas) {
          const currentId = currentPlayerIdRef.current;
          let fogData: { visibleCells: Set<string>; revealedCells: Set<string>; lastKnownEnemies: Map<string, EntitySnapshot> } | null = null;
          if (fogOfWarEnabledRef.current && currentId) {
            const sources = getVisionSources(st.entities, currentId);
            const visible = computeVisibleCells(sources, config.mapWidth, config.mapHeight, FOG_CELL_SIZE);
            revealedCellsRef.current = new Set([...revealedCellsRef.current, ...visible]);
            lastKnownEnemiesRef.current = updateLastKnownEnemies(
              st.entities,
              currentId,
              visible,
              FOG_CELL_SIZE,
              lastKnownEnemiesRef.current,
            );
            fogData = {
              visibleCells: visible,
              revealedCells: revealedCellsRef.current,
              lastKnownEnemies: lastKnownEnemiesRef.current,
            };
          }
          if (vp && vp.width > 0 && vp.height > 0) {
            renderer.resize(vp.width, vp.height);
            renderer.render(st, vp, currentId, fogData);
          } else {
            renderer.resize(config.mapWidth, config.mapHeight);
            renderer.render(st, undefined, currentId, fogData);
          }
        }
        rafId = requestAnimationFrame(renderLoop);
      };
      rafId = requestAnimationFrame(renderLoop);

      const syncState = (snapshot: GameStateSnapshot) => {
        stateRef.current = snapshot;
        setState(snapshot);
      };
      multiplayerSocket.on("game:state", syncState);

      return () => {
        multiplayerSocket.off("game:state", syncState);
        cancelAnimationFrame(rafId);
        renderer.destroy();
        rendererRef.current = null;
        socketRef.current = null;
        setGame(null);
        setState(null);
        setPlayerId(null);
      };
    }

    if (mode === "multiplayer" && !multiplayerSocket) {
      return;
    }

    const engine = new Game(config);
    gameRef.current = engine;

    // Восстанавливаем дополнительные здания из localStorage
    try {
      const raw = window.localStorage.getItem(EXTRA_BUILDINGS_KEY);
      if (raw) {
        const list = JSON.parse(raw) as ExtraBuilding[];
        if (Array.isArray(list)) {
          for (const b of list) {
            if (b.kind === "barrack") {
              engine.addBarrack(b.ownerId, b.position, { id: b.id });
            } else if (b.kind === "tower") {
              engine.addTower(b.ownerId, b.position, { id: b.id });
            }
          }
        }
      }
    } catch {
      // игнорируем ошибки
    }

    try {
      const raw = window.localStorage.getItem(NEUTRAL_POINTS_KEY);
      if (raw) {
        const list = JSON.parse(raw) as StoredNeutralPoint[];
        if (Array.isArray(list)) {
          for (const pt of list) {
            engine.addNeutralPoint(pt.position, {
              id: pt.id,
              radius: pt.radius,
              captureRadius: pt.captureRadius,
              goldPerInterval: pt.goldPerInterval,
              goldIntervalMs: pt.goldIntervalMs,
            });
          }
        }
      }
    } catch {
      // игнорируем ошибки
    }

    const playerColors = Object.fromEntries(config.players.map((p) => [p.id, p.color]));
    const renderer = new CanvasRenderer(canvas, {
      showRoutes: true,
      playerColors,
    });

    const loop = new GameLoop((deltaTimeMs) => {
      engine.update(deltaTimeMs);
      const snapshot = engine.getStateSnapshot();
      const currentId = currentPlayerIdRef.current;
      let fogData: { visibleCells: Set<string>; revealedCells: Set<string>; lastKnownEnemies: Map<string, EntitySnapshot> } | null = null;
      if (fogOfWarEnabledRef.current && currentId) {
        const sources = getVisionSources(snapshot.entities, currentId);
        const visible = computeVisibleCells(sources, config.mapWidth, config.mapHeight, FOG_CELL_SIZE);
        revealedCellsRef.current = new Set([...revealedCellsRef.current, ...visible]);
        lastKnownEnemiesRef.current = updateLastKnownEnemies(
          snapshot.entities,
          currentId,
          visible,
          FOG_CELL_SIZE,
          lastKnownEnemiesRef.current,
        );
        fogData = {
          visibleCells: visible,
          revealedCells: revealedCellsRef.current,
          lastKnownEnemies: lastKnownEnemiesRef.current,
        };
      }
      const vp = viewportRef?.current;
      if (vp && vp.width > 0 && vp.height > 0) {
        renderer.resize(vp.width, vp.height);
        renderer.render(snapshot, vp, currentId, fogData);
      } else {
        renderer.resize(config.mapWidth, config.mapHeight);
        renderer.render(snapshot, undefined, currentId, fogData);
      }
      if (snapshot.gameOver) {
        loop.stop();
      }
    });

    const unsubscribe = engine.subscribe((snapshot) => {
      setState(snapshot);
    });

    loop.start();

    setGame(engine);
    rendererRef.current = renderer;
    loopRef.current = loop;

    return () => {
      unsubscribe();
      loop.stop();
      renderer.destroy();
      gameRef.current = null;
      rendererRef.current = null;
      loopRef.current = null;
      setGame(null);
      setState(null);
    };
  }, [canvasRef, config, viewportRef, mode, multiplayerSocket, multiplayerPlayerId]);

  useEffect(() => {
    if (mode === "local" && game) {
      game.setHumanPlayerIds(new Set(localHumanPlayerId ? [localHumanPlayerId] : []));
    }
  }, [mode, game, localHumanPlayerId]);

  const prevFogPlayerIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextId = mode === "multiplayer" ? multiplayerPlayerId ?? null : localHumanPlayerId ?? null;
    if (prevFogPlayerIdRef.current !== nextId) {
      prevFogPlayerIdRef.current = nextId;
      revealedCellsRef.current = new Set();
      lastKnownEnemiesRef.current = new Map();
    }
  }, [mode, multiplayerPlayerId, localHumanPlayerId]);

  const setBarrackRoute = useCallback((barrackId: string, waypoints: { x: number; y: number }[]) => {
    if (mode === "multiplayer") {
      const pid = playerIdRef.current;
      if (pid && socketRef.current) {
        socketRef.current.emit("game:action", {
          type: "setBarrackRoute",
          playerId: pid,
          barrackId,
          waypoints,
        });
      }
    } else {
      gameRef.current?.setBarrackRoute(barrackId, waypoints);
    }
  }, [mode]);

  const setBuildingPosition = useCallback((entityId: string, position: { x: number; y: number }) => {
    if (mode === "multiplayer") return;
    gameRef.current?.setBuildingPosition(entityId, position);
  }, [mode]);

  const addBarrack = useCallback(
    (playerId: string, position: { x: number; y: number }): string | null => {
      if (mode === "multiplayer") return null;
      const id = gameRef.current?.addBarrack(playerId, position) ?? null;
      if (id && typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(EXTRA_BUILDINGS_KEY);
          const list = raw ? (JSON.parse(raw) as ExtraBuilding[]) : [];
          list.push({ id, kind: "barrack", ownerId: playerId, position });
          window.localStorage.setItem(EXTRA_BUILDINGS_KEY, JSON.stringify(list));
        } catch {
          // игнорируем
        }
      }
      return id;
    },
    [mode],
  );

  const addTower = useCallback(
    (playerId: string, position: { x: number; y: number }): string | null => {
      if (mode === "multiplayer") return null;
      const id = gameRef.current?.addTower(playerId, position) ?? null;
      if (id && typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(EXTRA_BUILDINGS_KEY);
          const list = raw ? (JSON.parse(raw) as ExtraBuilding[]) : [];
          list.push({ id, kind: "tower", ownerId: playerId, position });
          window.localStorage.setItem(EXTRA_BUILDINGS_KEY, JSON.stringify(list));
        } catch {
          // игнорируем
        }
      }
      return id;
    },
    [mode],
  );

  const addNeutralPoint = useCallback(
    (position: { x: number; y: number }, options?: Partial<StoredNeutralPoint>): string | null => {
      if (mode === "multiplayer") return null;
      const id = gameRef.current?.addNeutralPoint(position, options) ?? null;
      if (id && typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(NEUTRAL_POINTS_KEY);
          const list = raw ? (JSON.parse(raw) as StoredNeutralPoint[]) : [];
          list.push({
            id,
            position,
            radius: options?.radius ?? 12,
            captureRadius: options?.captureRadius ?? 80,
            goldPerInterval: options?.goldPerInterval ?? 2,
            goldIntervalMs: options?.goldIntervalMs ?? 5000,
          });
          window.localStorage.setItem(NEUTRAL_POINTS_KEY, JSON.stringify(list));
        } catch {
          // игнорируем
        }
      }
      return id;
    },
    [mode],
  );

  const removeNeutralPoint = useCallback((id: string): boolean => {
    if (mode === "multiplayer") return false;
    const ok = gameRef.current?.removeNeutralPoint(id) ?? false;
    if (ok && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(NEUTRAL_POINTS_KEY);
        const list = raw ? (JSON.parse(raw) as StoredNeutralPoint[]) : [];
        const filtered = list.filter((p) => p.id !== id);
        window.localStorage.setItem(NEUTRAL_POINTS_KEY, JSON.stringify(filtered));
      } catch {
        // игнорируем
      }
    }
    return ok;
  }, [mode]);

  const buyCastleUpgrade = useCallback(
    (targetPlayerId: string, trackId: import("../core/Game").CastleUpgradeTrack): boolean => {
      if (mode === "multiplayer") {
        const pid = playerIdRef.current;
        if (pid === targetPlayerId && socketRef.current) {
          socketRef.current.emit("game:action", {
            type: "buyCastleUpgrade",
            playerId: targetPlayerId,
            trackId,
          });
          return true;
        }
        return false;
      }
      return gameRef.current?.buyCastleUpgrade(targetPlayerId, trackId) ?? false;
    },
    [mode],
  );

  const buyBarrackUpgrade = useCallback(
    (targetPlayerId: string, barrackId: string): boolean => {
      if (mode === "multiplayer") {
        const pid = playerIdRef.current;
        if (pid === targetPlayerId && socketRef.current) {
          socketRef.current.emit("game:action", {
            type: "buyBarrackUpgrade",
            playerId: targetPlayerId,
            barrackId,
          });
          return true;
        }
        return false;
      }
      return gameRef.current?.buyBarrackUpgrade(targetPlayerId, barrackId) ?? false;
    },
    [mode],
  );

  const buyBarrackWarrior = useCallback(
    (targetPlayerId: string, barrackId: string): boolean => {
      if (mode === "multiplayer") {
        const pid = playerIdRef.current;
        if (pid === targetPlayerId && socketRef.current) {
          socketRef.current.emit("game:action", {
            type: "buyBarrackWarrior",
            playerId: targetPlayerId,
            barrackId,
          });
          return true;
        }
        return false;
      }
      return gameRef.current?.buyBarrackWarrior(targetPlayerId, barrackId) ?? false;
    },
    [mode],
  );

  const repairBarrack = useCallback(
    (targetPlayerId: string, barrackId: string): boolean => {
      if (mode === "multiplayer") {
        const pid = playerIdRef.current;
        if (pid === targetPlayerId && socketRef.current) {
          socketRef.current.emit("game:action", {
            type: "repairBarrack",
            playerId: targetPlayerId,
            barrackId,
          });
          return true;
        }
        return false;
      }
      return gameRef.current?.repairBarrack(targetPlayerId, barrackId) ?? false;
    },
    [mode],
  );

  const castCastleSpell = useCallback(
    (targetPlayerId: string, castleId: string, spellIndex: 0 | 1 = 0): boolean => {
      if (mode === "multiplayer") {
        const pid = playerIdRef.current;
        if (pid === targetPlayerId && socketRef.current) {
          socketRef.current.emit("game:action", {
            type: "castCastleSpell",
            playerId: targetPlayerId,
            castleId,
            spellIndex,
          });
          return true;
        }
        return false;
      }
      return gameRef.current?.castCastleSpell(targetPlayerId, castleId, spellIndex) ?? false;
    },
    [mode],
  );

  const summonHero = useCallback(
    (targetPlayerId: string, barrackId: string, heroTypeId: string): boolean => {
      if (mode === "multiplayer") {
        const pid = playerIdRef.current;
        if (pid === targetPlayerId && socketRef.current) {
          socketRef.current.emit("game:action", {
            type: "summonHero",
            playerId: targetPlayerId,
            barrackId,
            heroTypeId,
          });
          return true;
        }
        return false;
      }
      return gameRef.current?.summonHero(targetPlayerId, barrackId, heroTypeId) ?? false;
    },
    [mode],
  );

  const setSpawningEnabled = useCallback((enabled: boolean): void => {
    if (mode === "multiplayer") return;
    gameRef.current?.setSpawningEnabled(enabled);
  }, [mode]);

  const setAutoDevelopmentEnabled = useCallback((enabled: boolean): void => {
    if (mode === "multiplayer") {
      const pid = playerIdRef.current;
      if (pid && socketRef.current) {
        socketRef.current.emit("game:action", {
          type: "setAutoDevelopmentEnabled",
          playerId: pid,
          enabled,
        });
      }
      return;
    }
    gameRef.current?.setAutoDevelopmentEnabled(enabled);
  }, [mode]);

  const isAutoDevelopmentEnabled = useCallback((): boolean => {
    return gameRef.current?.isAutoDevelopmentEnabled() ?? true;
  }, []);

  const setFogOfWarEnabled = useCallback((enabled: boolean): void => {
    fogOfWarEnabledRef.current = enabled;
  }, []);

  const isFogOfWarEnabled = useCallback((): boolean => {
    return fogOfWarEnabledRef.current;
  }, []);

  return {
    game,
    state,
    playerId,
    setBarrackRoute,
    setBuildingPosition,
    addBarrack,
    addTower,
    addNeutralPoint,
    removeNeutralPoint,
    buyCastleUpgrade,
    buyBarrackUpgrade,
    buyBarrackWarrior,
    repairBarrack,
    castCastleSpell,
    summonHero,
    setSpawningEnabled,
    setAutoDevelopmentEnabled,
    isAutoDevelopmentEnabled,
    setFogOfWarEnabled,
    isFogOfWarEnabled,
  };
}
