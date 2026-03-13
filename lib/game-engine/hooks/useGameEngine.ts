"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Game } from "../core/Game";
import type { GameConfig } from "../config/defaultConfig";
import { GameLoop } from "../core/GameLoop";
import {
  CanvasRenderer,
  type ViewportState,
} from "../renderer/CanvasRenderer";
import type { GameStateSnapshot } from "../core/Game";

export interface ExtraBuilding {
  id: string;
  kind: "barrack" | "tower";
  ownerId: string;
  position: { x: number; y: number };
}

export interface UseGameEngineResult {
  game: Game | null;
  state: GameStateSnapshot | null;
  setBarrackRoute: (barrackId: string, waypoints: { x: number; y: number }[]) => void;
  setBuildingPosition: (entityId: string, position: { x: number; y: number }) => void;
  addBarrack: (playerId: string, position: { x: number; y: number }) => string | null;
  addTower: (playerId: string, position: { x: number; y: number }) => string | null;
  buyUpgrade: (playerId: string, upgradeId: string) => boolean;
  buyBarrackUpgrade: (playerId: string, barrackId: string, upgradeId: string) => boolean;
  buyBarrackWarrior: (playerId: string, barrackId: string) => boolean;
  setSpawningEnabled: (enabled: boolean) => void;
  setAutoDevelopmentEnabled: (enabled: boolean) => void;
  isAutoDevelopmentEnabled: () => boolean;
}

const EXTRA_BUILDINGS_KEY = "rts-extra-buildings";

/**
 * Инициализирует Game, GameLoop и CanvasRenderer, привязывая их к canvasRef.
 * viewportRef: ref с актуальным viewport (pan, zoom, size). Если задан, canvas
 * ресайзится под viewport и рендер использует pan/zoom.
 */
export function useGameEngine(
  canvasRef: RefObject<HTMLCanvasElement>,
  config: GameConfig,
  viewportRef?: RefObject<ViewportState | null>,
): UseGameEngineResult {
  const [game, setGame] = useState<Game | null>(null);
  const [state, setState] = useState<GameStateSnapshot | null>(null);

  const gameRef = useRef<Game | null>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    const playerColors = Object.fromEntries(config.players.map((p) => [p.id, p.color]));
    const renderer = new CanvasRenderer(canvas, {
      showRoutes: true,
      playerColors,
    });

    const loop = new GameLoop((deltaTimeMs) => {
      engine.update(deltaTimeMs);
      const snapshot = engine.getStateSnapshot();
      const vp = viewportRef?.current;
      if (vp && vp.width > 0 && vp.height > 0) {
        renderer.resize(vp.width, vp.height);
        renderer.render(snapshot, vp);
      } else {
        renderer.resize(config.mapWidth, config.mapHeight);
        renderer.render(snapshot);
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
  }, [canvasRef, config, viewportRef]);

  const setBarrackRoute = useCallback((barrackId: string, waypoints: { x: number; y: number }[]) => {
    gameRef.current?.setBarrackRoute(barrackId, waypoints);
  }, []);

  const setBuildingPosition = useCallback((entityId: string, position: { x: number; y: number }) => {
    gameRef.current?.setBuildingPosition(entityId, position);
  }, []);

  const addBarrack = useCallback(
    (playerId: string, position: { x: number; y: number }): string | null => {
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
    [],
  );

  const addTower = useCallback(
    (playerId: string, position: { x: number; y: number }): string | null => {
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
    [],
  );

  const buyUpgrade = useCallback((playerId: string, upgradeId: string): boolean => {
    return gameRef.current?.buyUpgrade(playerId, upgradeId) ?? false;
  }, []);

  const buyBarrackUpgrade = useCallback(
    (playerId: string, barrackId: string, upgradeId: string): boolean => {
      return gameRef.current?.buyBarrackUpgrade(playerId, barrackId, upgradeId) ?? false;
    },
    [],
  );

  const buyBarrackWarrior = useCallback(
    (playerId: string, barrackId: string): boolean => {
      return gameRef.current?.buyBarrackWarrior(playerId, barrackId) ?? false;
    },
    [],
  );

  const setSpawningEnabled = useCallback((enabled: boolean): void => {
    gameRef.current?.setSpawningEnabled(enabled);
  }, []);

  const setAutoDevelopmentEnabled = useCallback((enabled: boolean): void => {
    gameRef.current?.setAutoDevelopmentEnabled(enabled);
  }, []);

  const isAutoDevelopmentEnabled = useCallback((): boolean => {
    return gameRef.current?.isAutoDevelopmentEnabled() ?? true;
  }, []);

  return {
    game,
    state,
    setBarrackRoute,
    setBuildingPosition,
    addBarrack,
    addTower,
    buyUpgrade,
    buyBarrackUpgrade,
    buyBarrackWarrior,
    setSpawningEnabled,
    setAutoDevelopmentEnabled,
    isAutoDevelopmentEnabled,
  };
}
