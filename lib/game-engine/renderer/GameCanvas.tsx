"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, TouchEvent } from "react";
import { useGamePageHudWriter } from "@/lib/GamePageHudContext";
import { useGameEngine, type GameEngineMode } from "../hooks/useGameEngine";
import type { GameConfig } from "../config/defaultConfig";
import type { ViewportState } from "./CanvasRenderer";
import { DevelopmentPanel } from "./DevelopmentPanel";
import { BuildingUpgradePanel } from "./BuildingUpgradePanel";
import { HeroStatsPanel } from "./HeroStatsPanel";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const PAN_THRESHOLD_DESKTOP = 8;
const PAN_THRESHOLD_MOBILE = 50;
/** На мобилке пан не стартует сразу — нужна задержка, чтобы короткий тап не считался жестом прокрутки. */
const PAN_DELAY_MOBILE_MS = 100;

const isDev = process.env.NODE_ENV === "development";

/**
 * Обёртка над canvas, которая запускает игровой движок внутри себя
 * и позволяет вручную задавать маршрут для воинов одного барака
 * кликами по полю.
 */
export interface GameCanvasProps {
  config: GameConfig;
  className?: string;
  style?: CSSProperties;
  /**
   * Необязательный ID барака, для которого редактируется маршрут.
   * Если не задан, используется первый барак первого игрока.
   */
  editableBarrackId?: string;
  /**
   * Ключ для localStorage. Если не задан, берётся rts-route-{barrackId}.
   */
  persistKey?: string;
  /**
   * Шаг сетки для привязки зданий (0 = без привязки).
   */
  gridSize?: number;
  /**
   * Режим: local — локальная игра, multiplayer — подключение к серверу.
   */
  mode?: GameEngineMode;
  /**
   * URL сокет-сервера для multiplayer.
   */
  socketUrl?: string;
  /**
   * При multiplayer с лобби — сокет и состояние после game:start.
   */
  multiplayerSocket?: import("socket.io-client").Socket;
  multiplayerPlayerId?: string | null;
  multiplayerGameState?: import("../core/Game").GameStateSnapshot | null;
}

export function GameCanvas({
  config,
  className,
  style,
  editableBarrackId,
  persistKey,
  gridSize = 20,
  mode = "local",
  socketUrl,
  multiplayerSocket,
  multiplayerPlayerId,
  multiplayerGameState,
}: GameCanvasProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<ViewportState | null>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const panZoomRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1 });
  panZoomRef.current = { pan, zoom };
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );
  const pointerDownTimeRef = useRef<number>(0);
  const lastPinchRef = useRef<{
    dist: number;
    pan: { x: number; y: number };
    center: { x: number; y: number };
  } | null>(null);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    () => config.players[0]?.id ?? null,
  );
  const [devPanelPlayerId, setDevPanelPlayerId] = useState<string | null>(
    () => config.players[0]?.id ?? null,
  );

  const [fogOfWarEnabled, setFogOfWarEnabledState] = useState(true);
  const {
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
    setFogOfWarEnabled,
  } = useGameEngine(baseCanvasRef, config, viewportRef, {
    mode,
    socketUrl,
    multiplayerSocket,
    multiplayerPlayerId,
    multiplayerGameState,
    localHumanPlayerId: mode === "local" ? selectedPlayerId : undefined,
    fogOfWarEnabled,
  });

  const defaultPlayer = config.players[0];
  const defaultBarrack = defaultPlayer?.barracks[0];

  type EditorMode = "routes" | "buildings" | "test";
  type BuildingAction =
    | "move"
    | "upgrade"
    | "addBarrack"
    | "addTower"
    | "addNeutralPoint"
    | "removeNeutralPoint";

  const [editorMode, setEditorMode] = useState<EditorMode>("test");
  const effectiveMode = isDev ? editorMode : ("test" as EditorMode);

  useEffect(() => {
    setSpawningEnabled(effectiveMode === "test");
  }, [effectiveMode, setSpawningEnabled]);

  // На мобилке preventDefault не работает в React-обработчиках (passive: true по умолчанию).
  // Вешаем нативный listener с passive: false, чтобы блокировать скролл/zoom и улучшить тапы.
  useEffect(() => {
    const el = overlayCanvasRef.current;
    if (!el) return;
    const onTouchStart = (e: Event) => {
      const te = e as unknown as TouchEvent;
      if (te.touches?.length === 1) e.preventDefault();
    };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => el.removeEventListener("touchstart", onTouchStart);
  }, []);

  useEffect(() => {
    if (mode === "multiplayer" && playerId) {
      setSelectedPlayerId(playerId);
      setDevPanelPlayerId(playerId);
    }
  }, [mode, playerId]);
  const [buildingAction, setBuildingAction] = useState<BuildingAction>("move");

  const [selectedBarrackId, setSelectedBarrackId] = useState<string | null>(
    () => editableBarrackId ?? defaultBarrack?.id ?? null,
  );
  const [waypoints, setWaypoints] = useState<{ x: number; y: number }[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [upgradePanelBuildingId, setUpgradePanelBuildingId] = useState<
    string | null
  >(null);
  const [selectedNeutralPointId, setSelectedNeutralPointId] = useState<
    string | null
  >(null);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px), (pointer: coarse)");
    const check = () => setIsMobile(mq.matches);
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);

  useEffect(() => {
    if (!upgradePanelBuildingId || !state) return;
    const entity = state.entities.find((e) => e.id === upgradePanelBuildingId);
    if (!entity || !entity.isAlive) {
      setUpgradePanelBuildingId(null);
    }
  }, [upgradePanelBuildingId, state]);

  useEffect(() => {
    if (!selectedHeroId || !state) return;
    const entity = state.entities.find((e) => e.id === selectedHeroId);
    if (!entity || !entity.isAlive || !entity.isHero) {
      setSelectedHeroId(null);
    }
  }, [selectedHeroId, state]);

  useEffect(() => {
    if (effectiveMode !== "test") setSelectedHeroId(null);
  }, [effectiveMode]);
  const [buildingPositions, setBuildingPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [autoDevelopmentEnabled, setAutoDevelopmentEnabledState] =
    useState(true);

  const BUILDINGS_STORAGE_KEY = "rts-buildings";
  const HERO_NAMES_STORAGE_KEY = "rts-hero-names";

  const DEFAULT_HERO_NAMES: Record<string, string> = {
    "hero-1": "Нурик",
    "hero-2": "Паша",
    "hero-3": "Витя",
  };

  const [showHeroNamesModal, setShowHeroNamesModal] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !window.localStorage.getItem("rts-hero-names-modal-dismissed");
    } catch {
      return true;
    }
  });

  const [heroNamesByPlayer, setHeroNamesByPlayer] = useState<
    Record<string, Record<string, string>>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(HERO_NAMES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<
          string,
          Record<string, string>
        >;
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [heroNameInputs, setHeroNameInputs] = useState(DEFAULT_HERO_NAMES);

  const saveHeroNames = useCallback(
    (playerId: string) => {
      const next = { ...heroNamesByPlayer };
      next[playerId] = { ...DEFAULT_HERO_NAMES, ...heroNameInputs };
      setHeroNamesByPlayer(next);
      setShowHeroNamesModal(false);
      try {
        window.localStorage.setItem("rts-hero-names-modal-dismissed", "1");
        window.localStorage.setItem(
          HERO_NAMES_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // ignore
      }
    },
    [heroNamesByPlayer, heroNameInputs],
  );

  useEffect(() => {
    if (showHeroNamesModal && selectedPlayerId) {
      const existing = heroNamesByPlayer[selectedPlayerId];
      setHeroNameInputs(
        existing
          ? { ...DEFAULT_HERO_NAMES, ...existing }
          : { ...DEFAULT_HERO_NAMES },
      );
    }
  }, [showHeroNamesModal, selectedPlayerId]);

  const toggleAutoDevelopment = useCallback(() => {
    setAutoDevelopmentEnabledState((v) => {
      const next = !v;
      setAutoDevelopmentEnabled(next);
      return next;
    });
  }, [setAutoDevelopmentEnabled]);

  const setGamePageHud = useGamePageHudWriter();

  useEffect(() => {
    if (!setGamePageHud) return;
    if (effectiveMode !== "test") {
      setGamePageHud(null);
      return;
    }
    const currentPlayerId = playerId ?? selectedPlayerId;
    const ps =
      state && currentPlayerId
        ? state.playerStates[currentPlayerId]
        : null;
    if (!state || !ps) {
      setGamePageHud(null);
      return;
    }
    const player = config.players.find((p) => p.id === currentPlayerId);
    setGamePageHud({
      gold: Math.floor(ps.gold),
      goldPerSecond: ps.goldPerSecond ?? 0,
      autoDevelopmentEnabled,
      onToggleAuto: toggleAutoDevelopment,
      playerAccentColor: player?.color,
    });
    return () => setGamePageHud(null);
  }, [
    setGamePageHud,
    effectiveMode,
    state,
    selectedPlayerId,
    playerId,
    autoDevelopmentEnabled,
    toggleAutoDevelopment,
    config.players,
  ]);

  const toggleFogOfWar = useCallback(() => {
    setFogOfWarEnabledState((v) => {
      const next = !v;
      setFogOfWarEnabled(next);
      return next;
    });
  }, [setFogOfWarEnabled]);

  const POINT_RADIUS = 7;
  const POINT_HIT_RADIUS = 10;

  const mapW = config.mapWidth;
  const mapH = config.mapHeight;

  const getScale = useCallback(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return 1;
    return (
      Math.min(viewportSize.width / mapW, viewportSize.height / mapH) * zoom
    );
  }, [viewportSize, zoom, mapW, mapH]);

  const clampPan = useCallback(
    (p: { x: number; y: number }) => {
      const scale = getScale();
      const visibleW = scale > 0 ? viewportSize.width / scale : mapW;
      const visibleH = scale > 0 ? viewportSize.height / scale : mapH;
      return {
        x: Math.max(0, Math.min(mapW - visibleW, p.x)),
        y: Math.max(0, Math.min(mapH - visibleH, p.y)),
      };
    },
    [getScale, viewportSize, mapW, mapH],
  );

  useEffect(() => {
    const el = viewportContainerRef.current;
    if (!el) return;
    const update = () => {
      setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const scale = getScale();
    const visibleW = scale > 0 ? viewportSize.width / scale : mapW;
    const visibleH = scale > 0 ? viewportSize.height / scale : mapH;
    const clamped = clampPan(pan);
    viewportRef.current = {
      panX: clamped.x,
      panY: clamped.y,
      zoom,
      width: viewportSize.width,
      height: viewportSize.height,
      mapWidth: mapW,
      mapHeight: mapH,
    };
  }, [pan, zoom, viewportSize, getScale, clampPan, mapW, mapH]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || viewportSize.width <= 0 || viewportSize.height <= 0) return;
    overlay.width = viewportSize.width;
    overlay.height = viewportSize.height;
  }, [viewportSize.width, viewportSize.height]);

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const prevent = (e: Event) => e.preventDefault();
    overlay.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      overlay.removeEventListener("touchmove", prevent);
    };
  }, []);

  // Загружаем сохранённые позиции зданий из localStorage и применяем в движке при появлении game.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(BUILDINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<
          string,
          { x: number; y: number }
        >;
        if (parsed && typeof parsed === "object") {
          setBuildingPositions(parsed);
        }
      }
    } catch {
      // игнорируем
    }
  }, []);

  // Применяем сохранённые позиции зданий в движке (при загрузке из localStorage и при смене buildingPositions).
  useEffect(() => {
    if (!setBuildingPosition || Object.keys(buildingPositions).length === 0)
      return;

    Object.entries(buildingPositions).forEach(([entityId, pos]) => {
      setBuildingPosition(entityId, pos);
    });
  }, [setBuildingPosition, buildingPositions]);

  // При загрузке страницы восстанавливаем маршруты для ВСЕХ бараков из localStorage.
  useEffect(() => {
    if (!setBarrackRoute || typeof window === "undefined") return;

    const barrackIds = config.players.flatMap((p) =>
      p.barracks.map((b) => b.id),
    );

    try {
      const rawExtra = window.localStorage.getItem("rts-extra-buildings");
      if (rawExtra) {
        const extra = JSON.parse(rawExtra) as { id: string; kind: string }[];
        if (Array.isArray(extra)) {
          extra
            .filter((b) => b.kind === "barrack")
            .forEach((b) => barrackIds.push(b.id));
        }
      }
    } catch {
      // игнорируем
    }

    barrackIds.forEach((barrackId) => {
      const key = persistKey ?? `rts-route-${barrackId}`;
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { x: number; y: number }[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBarrackRoute(barrackId, parsed);
          }
        }
      } catch {
        // игнорируем
      }
    });
    // Однократно при монтировании — восстанавливаем маршруты всех бараков.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Загружаем маршрут для выбранного барака из localStorage и применяем его в движке.
  useEffect(() => {
    if (!selectedBarrackId) {
      setWaypoints([]);
      return;
    }

    if (typeof window === "undefined") return;

    const key = persistKey ?? `rts-route-${selectedBarrackId}`;

    // Пытаемся прочитать маршрут в порядке приоритета:
    // 1) localStorage
    // 2) defaultRoute из конфигурации
    // 3) пустой маршрут

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        // localStorage пустой — пробуем найти дефолт в конфиге
        const barrackConfig = config.players
          .flatMap((p) => p.barracks)
          .find((b) => b.id === selectedBarrackId);

        const defaultRoute = barrackConfig?.defaultRoute ?? [];
        setWaypoints(defaultRoute);
        setBarrackRoute(selectedBarrackId, defaultRoute);
        return;
      }

      const parsed = JSON.parse(raw) as { x: number; y: number }[];
      if (!Array.isArray(parsed)) {
        setWaypoints([]);
        setBarrackRoute(selectedBarrackId, []);
        return;
      }

      setWaypoints(parsed);
      setBarrackRoute(selectedBarrackId, parsed);
    } catch {
      setWaypoints([]);
      setBarrackRoute(selectedBarrackId, []);
    }
    // setBarrackRoute стабилен (useCallback в useGameEngine), не включаем в deps,
    // чтобы эффект срабатывал только при смене барака или ключа сохранения.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey, selectedBarrackId]);

  // Вспомогательная функция: сохраняем маршрут и отправляем в движок.
  const applyRoute = (
    barrackId: string,
    points: { x: number; y: number }[],
  ) => {
    setBarrackRoute(barrackId, points);

    if (typeof window === "undefined") return;

    const key = persistKey ?? `rts-route-${barrackId}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(points));
    } catch {
      // игнорируем ошибки
    }
  };

  const findBarrackAt = (x: number, y: number): string | null => {
    if (!state) return null;

    for (const entity of state.entities) {
      if (entity.kind !== "barrack") continue;
      const dx = x - entity.position.x;
      const dy = y - entity.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= entity.radius + 6) {
        return entity.id;
      }
    }

    return null;
  };

  const findBuildingAt = (
    x: number,
    y: number,
  ): { id: string; ownerId: string } | null => {
    if (!state) return null;

    let best: { id: string; ownerId: string; radius: number } | null = null;

    for (const entity of state.entities) {
      if (
        entity.kind !== "castle" &&
        entity.kind !== "barrack" &&
        entity.kind !== "tower"
      )
        continue;
      const dx = x - entity.position.x;
      const dy = y - entity.position.y;
      const dist = Math.hypot(dx, dy);
      const hitRadius = entity.radius + 8;
      if (dist <= hitRadius && (!best || entity.radius > best.radius)) {
        best = {
          id: entity.id,
          ownerId: entity.ownerId,
          radius: entity.radius,
        };
      }
    }
    return best ? { id: best.id, ownerId: best.ownerId } : null;
  };

  const findNeutralPointAt = (x: number, y: number) => {
    if (!state?.neutralPoints) return null;
    for (const pt of state.neutralPoints) {
      const dx = x - pt.position.x;
      const dy = y - pt.position.y;
      if (Math.hypot(dx, dy) <= pt.radius + 8) return pt;
    }
    return null;
  };

  const findHeroAt = useCallback(
    (x: number, y: number): string | null => {
      if (!state) return null;
      let best: { id: string; d: number } | null = null;
      for (const entity of state.entities) {
        if (entity.kind !== "warrior" || !entity.isHero || !entity.isAlive)
          continue;
        const d = Math.hypot(
          x - entity.position.x,
          y - entity.position.y,
        );
        if (d <= entity.radius + 8) {
          if (!best || d < best.d) best = { id: entity.id, d };
        }
      }
      return best?.id ?? null;
    },
    [state],
  );

  const clampToMap = (x: number, y: number) => ({
    x: Math.max(0, Math.min(config.mapWidth, x)),
    y: Math.max(0, Math.min(config.mapHeight, y)),
  });

  const snapToGrid = (pos: {
    x: number;
    y: number;
  }): { x: number; y: number } => {
    if (!gridSnapEnabled || !gridSize) return pos;
    return {
      x: Math.round(pos.x / gridSize) * gridSize,
      y: Math.round(pos.y / gridSize) * gridSize,
    };
  };

  const toFinalPosition = (x: number, y: number) => {
    const clamped = clampToMap(x, y);
    return snapToGrid(clamped);
  };

  const findWaypointIndexAt = (x: number, y: number): number | null => {
    for (let i = 0; i < waypoints.length; i += 1) {
      const wp = waypoints[i];
      const dx = x - wp.x;
      const dy = y - wp.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= POINT_HIT_RADIUS) {
        return i;
      }
    }
    return null;
  };

  const getGameCoordsFromClient = (
    clientX: number,
    clientY: number,
  ): { x: number; y: number } => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const vp = viewportRef.current;
    if (!vp || vp.width <= 0 || vp.height <= 0) {
      const scaleX = rect.width > 0 ? mapW / rect.width : 1;
      const scaleY = rect.height > 0 ? mapH / rect.height : 1;
      return { x: localX * scaleX, y: localY * scaleY };
    }
    const scale =
      Math.min(vp.width / vp.mapWidth, vp.height / vp.mapHeight) * vp.zoom;
    return {
      x: localX / scale + vp.panX,
      y: localY / scale + vp.panY,
    };
  };

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { pan: p, zoom: z } = panZoomRef.current;
      const rect = overlay.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const { x: mapX, y: mapY } = getGameCoordsFromClient(centerX, centerY);
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor));
      const scale = getScale();
      const newScale = scale * (newZoom / z);
      const dx = (mapX - p.x) * (1 - newScale / scale);
      const dy = (mapY - p.y) * (1 - newScale / scale);
      setPan((prev) => clampPan({ x: prev.x + dx, y: prev.y + dy }));
      setZoom(newZoom);
    };
    overlay.addEventListener("wheel", onWheel, { passive: false });
    return () => overlay.removeEventListener("wheel", onWheel);
  }, [getGameCoordsFromClient, getScale, clampPan]);

  const getGameCoords = (
    event: MouseEvent<HTMLCanvasElement>,
  ): { x: number; y: number } =>
    getGameCoordsFromClient(event.clientX, event.clientY);

  const executeGameClick = useCallback(
    (clientX: number, clientY: number) => {
      const { x, y } = getGameCoordsFromClient(clientX, clientY);

      if (effectiveMode === "test") {
        const heroId = findHeroAt(x, y);
        if (heroId && state) {
          const heroEntity = state.entities.find((e) => e.id === heroId);
          if (heroEntity?.isHero) {
            setSelectedHeroId(heroId);
            setUpgradePanelBuildingId(null);
            setSelectedNeutralPointId(null);
            return;
          }
        }
        const building = findBuildingAt(x, y);
        if (building && state) {
          const entity = state.entities.find((e) => e.id === building.id);
          if (
            entity &&
            (entity.kind === "castle" || entity.kind === "barrack")
          ) {
            setUpgradePanelBuildingId(building.id);
            setSelectedNeutralPointId(null);
            setSelectedHeroId(null);
          }
        } else {
          const neutralPt = findNeutralPointAt(x, y);
          if (neutralPt) {
            setSelectedNeutralPointId(neutralPt.id);
            setSelectedHeroId(null);
          } else {
            setSelectedNeutralPointId(null);
            setSelectedHeroId(null);
          }
        }
        return;
      }

      if (effectiveMode === "buildings") {
        const building = findBuildingAt(x, y);
        if (buildingAction === "upgrade" && building && state) {
          const entity = state.entities.find((e) => e.id === building.id);
          if (
            entity &&
            (entity.kind === "castle" || entity.kind === "barrack")
          ) {
            setUpgradePanelBuildingId(building.id);
            setSelectedPlayerId(building.ownerId);
            setSelectedNeutralPointId(null);
          }
          return;
        }
        if (buildingAction === "addBarrack" || buildingAction === "addTower") {
          if (!building && !findNeutralPointAt(x, y) && selectedPlayerId) {
            const pos = toFinalPosition(x, y);
            const id =
              buildingAction === "addBarrack"
                ? addBarrack(selectedPlayerId, pos)
                : addTower(selectedPlayerId, pos);
            if (id) {
              setBuildingPositions((prev) => {
                const next = { ...prev, [id]: pos };
                try {
                  window.localStorage.setItem(
                    BUILDINGS_STORAGE_KEY,
                    JSON.stringify(next),
                  );
                } catch {
                  // ignore
                }
                return next;
              });
            }
          }
          return;
        }
        if (buildingAction === "addNeutralPoint") {
          if (!building && !findNeutralPointAt(x, y)) {
            const pos = toFinalPosition(x, y);
            addNeutralPoint(pos);
          }
          return;
        }
        if (buildingAction === "removeNeutralPoint") {
          const neutralPt = findNeutralPointAt(x, y);
          if (neutralPt) {
            removeNeutralPoint(neutralPt.id);
            setSelectedNeutralPointId(null);
          }
          return;
        }
        const neutralPt = findNeutralPointAt(x, y);
        if (neutralPt) {
          setSelectedNeutralPointId(neutralPt.id);
          return;
        }
        if (building) {
          setSelectedPlayerId(building.ownerId);
          setSelectedBuildingId(building.id);
          setSelectedNeutralPointId(null);
        } else {
          setSelectedNeutralPointId(null);
        }
        return;
      }

      const barrackId = findBarrackAt(x, y);
      if (barrackId) {
        if (barrackId !== selectedBarrackId) setSelectedBarrackId(barrackId);
        return;
      }

      if (!selectedBarrackId) return;

      const index = findWaypointIndexAt(x, y);
      if (index !== null) {
        setDragIndex(index);
        return;
      }

      setWaypoints((prev) => {
        const next = [...prev, { x, y }];
        applyRoute(selectedBarrackId, next);
        return next;
      });
    },
    [
      effectiveMode,
      buildingAction,
      selectedPlayerId,
      selectedBarrackId,
      state,
      addBarrack,
      addTower,
      addNeutralPoint,
      removeNeutralPoint,
      setSelectedPlayerId,
      setSelectedBarrackId,
      setUpgradePanelBuildingId,
      applyRoute,
      findHeroAt,
    ],
  );

  const handlePointerDown = (clientX: number, clientY: number) => {
    const { x, y } = getGameCoordsFromClient(clientX, clientY);

    const waypointIdx = selectedBarrackId ? findWaypointIndexAt(x, y) : null;
    const buildingForMove =
      effectiveMode === "buildings" && buildingAction === "move"
        ? findBuildingAt(x, y)
        : null;

    if (waypointIdx !== null) {
      setDragIndex(waypointIdx);
      lastPointerRef.current = null;
      return;
    }
    if (buildingForMove) {
      setSelectedBuildingId(buildingForMove.id);
      setSelectedPlayerId(buildingForMove.ownerId);
      lastPointerRef.current = null;
      return;
    }

    isPanningRef.current = false;
    lastPointerRef.current = { clientX, clientY };
    pointerDownTimeRef.current = Date.now();
    lastPinchRef.current = null;
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    handlePointerDown(event.clientX, event.clientY);
  };

  const doPan = useCallback(
    (deltaX: number, deltaY: number) => {
      const scale = getScale();
      if (scale <= 0) return;
      setPan((p) =>
        clampPan({ x: p.x - deltaX / scale, y: p.y - deltaY / scale }),
      );
    },
    [getScale, clampPan],
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (dragIndex !== null && selectedBarrackId) {
        const { x, y } = getGameCoordsFromClient(clientX, clientY);
        const clamped = clampToMap(x, y);
        setWaypoints((prev) => {
          if (!prev[dragIndex]) return prev;
          const next = [...prev];
          next[dragIndex] = clamped;
          applyRoute(selectedBarrackId, next);
          return next;
        });
        return;
      }
      if (
        selectedBuildingId &&
        effectiveMode === "buildings" &&
        buildingAction === "move"
      ) {
        const { x, y } = getGameCoordsFromClient(clientX, clientY);
        const finalPos = toFinalPosition(x, y);
        setBuildingPosition(selectedBuildingId, finalPos);
        setBuildingPositions((prev) => {
          const next = { ...prev, [selectedBuildingId]: finalPos };
          try {
            window.localStorage.setItem(
              BUILDINGS_STORAGE_KEY,
              JSON.stringify(next),
            );
          } catch {
            // ignore
          }
          return next;
        });
        return;
      }

      const last = lastPointerRef.current;
      if (last) {
        const dx = clientX - last.clientX;
        const dy = clientY - last.clientY;
        const isMobile =
          typeof window !== "undefined" &&
          (window.matchMedia("(max-width: 640px)").matches ||
            window.matchMedia("(pointer: coarse)").matches);
        const panThreshold = isMobile
          ? PAN_THRESHOLD_MOBILE
          : PAN_THRESHOLD_DESKTOP;
        const elapsedMs = Date.now() - pointerDownTimeRef.current;
        const delayPassed = !isMobile || elapsedMs >= PAN_DELAY_MOBILE_MS;
        if (
          !isPanningRef.current &&
          delayPassed &&
          Math.hypot(dx, dy) > panThreshold
        ) {
          isPanningRef.current = true;
        }
        if (isPanningRef.current) {
          lastPointerRef.current = { clientX, clientY };
          doPan(dx, dy);
        }
      }
    },
    [
      dragIndex,
      selectedBarrackId,
      selectedBuildingId,
      effectiveMode,
      buildingAction,
      applyRoute,
      setBuildingPosition,
      doPan,
    ],
  );

  const handlePointerUp = useCallback(
    (clientX: number, clientY: number, isCancel = false) => {
      if (!isCancel && lastPointerRef.current && !isPanningRef.current) {
        executeGameClick(clientX, clientY);
      }
      lastPointerRef.current = null;
      lastPinchRef.current = null;
      setDragIndex(null);
      setSelectedBuildingId(null);
    },
    [executeGameClick],
  );

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>): void => {
    if (effectiveMode === "test" && !lastPointerRef.current) return;
    handlePointerMove(event.clientX, event.clientY);
  };

  const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0) return;
    handlePointerUp(event.clientX, event.clientY);
  };

  const handleContextMenu = (event: MouseEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    if (effectiveMode !== "routes" || !selectedBarrackId) return;

    const { x, y } = getGameCoords(event);

    const index = findWaypointIndexAt(x, y);
    if (index === null) return;

    setWaypoints((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      applyRoute(selectedBarrackId, next);
      return next;
    });
  };

  // Рисуем оверлей: выбранный барак, линии маршрута и точки с номерами.
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!state) return;

    const vp = viewportRef.current;
    if (vp && vp.width > 0 && vp.height > 0) {
      ctx.save();
      const scale =
        Math.min(vp.width / vp.mapWidth, vp.height / vp.mapHeight) * vp.zoom;
      ctx.setTransform(scale, 0, 0, scale, -vp.panX * scale, -vp.panY * scale);
    }

    if (effectiveMode === "buildings" && gridSnapEnabled && gridSize) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= mapW; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, mapH);
        ctx.stroke();
      }
      for (let gy = 0; gy <= mapH; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(mapW, gy);
        ctx.stroke();
      }
    }

    if (effectiveMode === "buildings") {
      state.entities.forEach((entity) => {
        if (
          entity.kind !== "castle" &&
          entity.kind !== "barrack" &&
          entity.kind !== "tower"
        )
          return;
        if (selectedPlayerId && entity.ownerId !== selectedPlayerId) return;
        const isSelected = entity.id === selectedBuildingId;
        ctx.strokeStyle = isSelected ? "#fbbf24" : "rgba(148, 163, 184, 0.8)";
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.setLineDash(isSelected ? [] : [4, 4]);
        ctx.beginPath();
        ctx.arc(
          entity.position.x,
          entity.position.y,
          entity.radius + 6,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(
          entity.kind === "castle"
            ? "Замок"
            : entity.kind === "barrack"
              ? "Барак"
              : "Башня",
          entity.position.x,
          entity.position.y - entity.radius - 10,
        );
      });
    }

    // Подсветка выбранного барака и маршруты — только в режиме маршрутов.
    if (effectiveMode === "routes" && selectedBarrackId) {
      const barrack = state.entities.find(
        (e) => e.kind === "barrack" && e.id === selectedBarrackId,
      );
      if (barrack) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          barrack.position.x,
          barrack.position.y,
          barrack.radius + 6,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }

    // Линии маршрута — только в режиме маршрутов, в тесте скрыты.
    if (effectiveMode === "routes" && waypoints.length > 1) {
      ctx.strokeStyle = "#38bdf8"; // sky-400
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(waypoints[0].x, waypoints[0].y);
      for (let i = 1; i < waypoints.length; i += 1) {
        ctx.lineTo(waypoints[i].x, waypoints[i].y);
      }
      ctx.stroke();
    }

    // Точки и номера маршрута — только в режиме маршрутов.
    if (effectiveMode === "routes") {
      waypoints.forEach((wp, index) => {
        ctx.fillStyle = "#0ea5e9"; // sky-500
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e5e7eb"; // gray-200
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(index + 1), wp.x, wp.y);
      });
    }

    if (vp && vp.width > 0 && vp.height > 0) {
      ctx.restore();
    }
  }, [
    POINT_RADIUS,
    effectiveMode,
    gridSnapEnabled,
    gridSize,
    selectedBarrackId,
    selectedBuildingId,
    selectedPlayerId,
    state,
    waypoints,
  ]);

  // Экспорт позиций зданий в консоль (для вставки в defaultConfig).
  useEffect(() => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__exportBuildingPositions = () => {
      const positions =
        typeof window !== "undefined"
          ? (() => {
              try {
                const raw = window.localStorage.getItem(BUILDINGS_STORAGE_KEY);
                return raw
                  ? (JSON.parse(raw) as Record<
                      string,
                      { x: number; y: number }
                    >)
                  : buildingPositions;
              } catch {
                return buildingPositions;
              }
            })()
          : buildingPositions;
      // eslint-disable-next-line no-console
      console.log(
        "// Позиции зданий (entityId -> position). Можно вшить в конфиг при инициализации.\n",
        JSON.stringify(positions, null, 2),
      );
    };
  }, [buildingPositions]);

  // Экспорт маршрутов для всех бараков в консоль, чтобы
  // можно было скопировать их в defaultConfig.ts как defaultRoute.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__exportBarrackRoutes = () => {
      const result = config.players.map((player) => {
        return {
          id: player.id,
          barracks: player.barracks.map((barrackConfig) => {
            const key = persistKey ?? `rts-route-${barrackConfig.id}`;
            let route: { x: number; y: number }[] | undefined;

            try {
              const raw = window.localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw) as { x: number; y: number }[];
                if (Array.isArray(parsed)) {
                  route = parsed;
                }
              }
            } catch {
              // игнорируем ошибки
            }

            return {
              id: barrackConfig.id,
              defaultRoute: route ?? barrackConfig.defaultRoute ?? [],
            };
          }),
        };
      });

      // Удобный фрагмент кода, который можно вставить в defaultConfig.ts
      // в секцию players[*].barracks[*].defaultRoute.
      // eslint-disable-next-line no-console
      console.log(
        "// Скопируйте defaultRoute для нужных бараков в defaultConfig.ts\n",
        JSON.stringify(result, null, 2),
      );
    };
  }, [config.players, persistKey]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col md:flex-row gap-2 md:gap-3 ${className ?? ""}`.trim()}
      style={style}
    >
      {showHeroNamesModal &&
        mode === "local" &&
        selectedPlayerId &&
        config.heroTypes &&
        Object.keys(config.heroTypes).length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 shadow-xl border border-slate-600">
              <p className="mb-4 text-slate-200 text-sm">
                В игре есть герои, ты можешь дать им имена, если хочешь:
              </p>
              <div className="space-y-3 mb-6">
                {(["hero-1", "hero-2", "hero-3"] as const).map((heroTypeId) => {
                  if (!config.heroTypes![heroTypeId]) return null;
                  return (
                    <label key={heroTypeId} className="block">
                      <span className="block text-xs text-slate-500 mb-1">
                        {(heroTypeId === "hero-1" && "Первый герой") ||
                          (heroTypeId === "hero-2" && "Второй герой") ||
                          (heroTypeId === "hero-3" && "Третий герой")}
                      </span>
                      <input
                        type="text"
                        value={
                          heroNameInputs[heroTypeId] ??
                          DEFAULT_HERO_NAMES[heroTypeId]
                        }
                        onChange={(e) =>
                          setHeroNameInputs((prev) => ({
                            ...prev,
                            [heroTypeId]:
                              e.target.value.trim() ||
                              DEFAULT_HERO_NAMES[heroTypeId],
                          }))
                        }
                        placeholder={DEFAULT_HERO_NAMES[heroTypeId]}
                        className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => saveHeroNames(selectedPlayerId)}
                  className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-900 hover:bg-amber-400 transition"
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        )}

      <div className="flex flex-1 flex-col gap-2 min-w-0">
        {isDev && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:gap-3 rounded-lg bg-slate-800/90 px-2 sm:px-3 py-2 text-xs sm:text-sm min-h-[3.5rem] sm:min-h-[4rem]">
            <span className="text-slate-400">Режим:</span>
            <div className="flex rounded-md bg-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setEditorMode("routes")}
                className={`rounded px-3 py-1 font-medium transition ${effectiveMode === "routes" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
              >
                Маршруты
              </button>
              <button
                type="button"
                onClick={() => setEditorMode("buildings")}
                className={`rounded px-3 py-1 font-medium transition ${effectiveMode === "buildings" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
              >
                Здания
              </button>
              <button
                type="button"
                onClick={() => setEditorMode("test")}
                className={`rounded px-3 py-1 font-medium transition ${effectiveMode === "test" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
              >
                Тест
              </button>
            </div>

            {effectiveMode === "routes" && (
              <span className="text-slate-500">
                Клик по бараку — выбрать. Клик по полю — добавить точку
                маршрута. ПКМ по точке — удалить.
              </span>
            )}

            {effectiveMode === "test" && (
              <>
                <span className="text-slate-500">
                  Симуляция. Клик по замку или бараку — улучшения.
                </span>
                <div className="hidden sm:flex sm:flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs sm:text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={autoDevelopmentEnabled}
                      onChange={toggleAutoDevelopment}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span>Авторазвитие</span>
                  </label>
                  {state &&
                    (() => {
                      const currentPlayerId = playerId ?? selectedPlayerId;
                      const ps = currentPlayerId
                        ? state.playerStates[currentPlayerId]
                        : null;
                      if (!ps) return null;
                      const player = config.players.find(
                        (p) => p.id === currentPlayerId,
                      );
                      return (
                        <div
                          className="flex items-center gap-1.5 rounded-full bg-slate-700/80 px-2.5 py-1.5 ring-1 ring-slate-600/60"
                          style={
                            player
                              ? { borderLeft: `3px solid ${player.color}` }
                              : undefined
                          }
                          aria-label={`Золото: ${Math.floor(ps.gold)}, инком ${(ps.goldPerSecond ?? 0).toFixed(1)}/с`}
                        >
                          <span className="text-sm leading-none">🪙</span>
                          <span className="font-semibold tabular-nums text-amber-400 text-sm min-w-[2.5rem]">
                            {Math.floor(ps.gold)}
                          </span>
                          {(ps.goldPerSecond ?? 0) > 0 && (
                            <span className="tabular-nums text-slate-400 text-xs">
                              +{(ps.goldPerSecond ?? 0).toFixed(1)}/с
                            </span>
                          )}
                        </div>
                      );
                    })()}
                </div>
              </>
            )}

            {effectiveMode === "buildings" && (
              <>
                <span className="text-slate-400">Действие:</span>
                <div className="flex rounded-md bg-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => setBuildingAction("move")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${buildingAction === "move" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
                  >
                    Перемещать
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildingAction("upgrade")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${buildingAction === "upgrade" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
                  >
                    Улучшения
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildingAction("addBarrack")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${buildingAction === "addBarrack" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
                  >
                    + Барак
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildingAction("addTower")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${buildingAction === "addTower" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
                  >
                    + Башня
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildingAction("addNeutralPoint")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${buildingAction === "addNeutralPoint" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:bg-slate-600"}`}
                  >
                    + Нейтральная точка
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildingAction("removeNeutralPoint")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${buildingAction === "removeNeutralPoint" ? "bg-red-600 text-white" : "text-slate-300 hover:bg-slate-600"}`}
                    title="Клик по нейтральной точке — удалить"
                  >
                    − Нейтральная точка
                  </button>
                </div>
                <span className="text-slate-400">Игрок:</span>
                <div className="flex gap-1">
                  {config.players.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlayerId(p.id)}
                      className={`rounded px-2 py-1 text-xs font-medium transition ${selectedPlayerId === p.id ? "bg-sky-500 text-white" : "bg-slate-600 text-slate-300 hover:bg-slate-500"}`}
                      style={
                        selectedPlayerId === p.id
                          ? { backgroundColor: p.color }
                          : undefined
                      }
                    >
                      {p.id.replace("player-", "Игрок ")}
                    </button>
                  ))}
                </div>
                {gridSize > 0 && (
                  <button
                    type="button"
                    onClick={() => setGridSnapEnabled((v) => !v)}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${gridSnapEnabled ? "bg-emerald-600 text-white" : "bg-slate-600 text-slate-300 hover:bg-slate-500"}`}
                    title={
                      gridSnapEnabled
                        ? `Привязка к сетке ${gridSize}px (вкл)`
                        : "Привязка к сетке выключена"
                    }
                  >
                    Сетка {gridSize}px {gridSnapEnabled ? "вкл" : "выкл"}
                  </button>
                )}
                <span className="text-slate-500">
                  {buildingAction === "move"
                    ? "Клик по зданию и перетащите для перемещения."
                    : buildingAction === "upgrade"
                      ? "Клик по замку или бараку — открыть панель улучшений."
                      : buildingAction === "addBarrack"
                        ? "Клик по пустому месту — добавить барак."
                        : buildingAction === "addTower"
                          ? "Клик по пустому месту — добавить башню."
                          : buildingAction === "addNeutralPoint"
                            ? "Клик по пустому месту — добавить нейтральную точку."
                            : buildingAction === "removeNeutralPoint"
                              ? "Клик по нейтральной точке — удалить."
                              : ""}{" "}
                  Позиции сохраняются автоматически.
                </span>
              </>
            )}
          </div>
        )}

        {!isDev && effectiveMode === "test" && (
          <div className="hidden sm:flex flex-shrink-0 flex-wrap items-center gap-2 sm:gap-3 rounded-lg bg-slate-800/90 px-2 sm:px-3 py-2 text-xs sm:text-sm min-h-[3rem] sm:min-h-[3.5rem]">
            <label className="flex cursor-pointer items-center gap-2 text-slate-200">
              <input
                type="checkbox"
                checked={autoDevelopmentEnabled}
                onChange={toggleAutoDevelopment}
                className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span>Авторазвитие</span>
            </label>
            {state &&
              (() => {
                const currentPlayerId = playerId ?? selectedPlayerId;
                const ps = currentPlayerId
                  ? state.playerStates[currentPlayerId]
                  : null;
                if (!ps) return null;
                const player = config.players.find(
                  (p) => p.id === currentPlayerId,
                );
                return (
                  <div
                    className="flex items-center gap-1.5 rounded-full bg-slate-700/80 px-2.5 py-1.5 ring-1 ring-slate-600/60"
                    style={
                      player
                        ? { borderLeft: `3px solid ${player.color}` }
                        : undefined
                    }
                    aria-label={`Золото: ${Math.floor(ps.gold)}, инком ${(ps.goldPerSecond ?? 0).toFixed(1)}/с`}
                  >
                    <span className="text-sm leading-none">🪙</span>
                    <span className="font-semibold tabular-nums text-amber-400 text-sm min-w-[2.5rem]">
                      {Math.floor(ps.gold)}
                    </span>
                    {(ps.goldPerSecond ?? 0) > 0 && (
                      <span className="tabular-nums text-slate-400 text-xs">
                        +{(ps.goldPerSecond ?? 0).toFixed(1)}/с
                      </span>
                    )}
                  </div>
                );
              })()}
          </div>
        )}

        <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
            <div
              ref={viewportContainerRef}
              className="relative shrink-0 w-full h-full min-h-0"
              style={{ aspectRatio: "1", maxWidth: "100%", maxHeight: "100%" }}
            >
              <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1 rounded-lg bg-slate-800/90 p-1 shadow-lg md:bottom-3 md:right-3">
                <button
                  type="button"
                  onClick={() => {
                    setZoom((z) => Math.min(ZOOM_MAX, z * 1.2));
                  }}
                  className="rounded px-2 py-1 text-sm font-bold text-slate-200 hover:bg-slate-600 transition leading-none"
                  aria-label="Приблизить"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom((z) => Math.max(ZOOM_MIN, z / 1.2));
                  }}
                  className="rounded px-2 py-1 text-sm font-bold text-slate-200 hover:bg-slate-600 transition leading-none"
                  aria-label="Отдалить"
                >
                  −
                </button>
              </div>
              {state?.gameOver && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/70">
                  <div className="rounded-xl bg-slate-800 px-8 py-6 text-center shadow-xl">
                    <h2 className="mb-2 text-xl font-bold text-amber-400">
                      Игра окончена
                    </h2>
                    <p className="text-slate-300">
                      {state.winnerIds.length > 0
                        ? `Победитель: ${state.winnerIds
                            .map(
                              (id) =>
                                config.players
                                  .find((p) => p.id === id)
                                  ?.id?.replace("player-", "Игрок ") ?? id,
                            )
                            .join(", ")}`
                        : "Все здания уничтожены"}
                    </p>
                  </div>
                </div>
              )}
              <canvas
                ref={baseCanvasRef}
                className="absolute inset-0 h-full w-full bg-slate-900 rounded-lg shadow-inner"
              />
              <canvas
                ref={overlayCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => handlePointerUp(0, 0, true)}
                onTouchStart={(e: TouchEvent<HTMLCanvasElement>) => {
                  if (e.touches.length === 2) {
                    const dx = e.touches[1].clientX - e.touches[0].clientX;
                    const dy = e.touches[1].clientY - e.touches[0].clientY;
                    lastPinchRef.current = {
                      dist: Math.hypot(dx, dy),
                      pan: { ...pan },
                      center: {
                        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                      },
                    };
                    lastPointerRef.current = null;
                  } else if (e.touches.length === 1) {
                    handlePointerDown(
                      e.touches[0].clientX,
                      e.touches[0].clientY,
                    );
                  }
                }}
                onTouchMove={(e: TouchEvent<HTMLCanvasElement>) => {
                  if (e.touches.length === 2 && lastPinchRef.current) {
                    const dx = e.touches[1].clientX - e.touches[0].clientX;
                    const dy = e.touches[1].clientY - e.touches[0].clientY;
                    const dist = Math.hypot(dx, dy);
                    const prev = lastPinchRef.current;
                    const factor = dist / prev.dist;
                    const newZoom = Math.max(
                      ZOOM_MIN,
                      Math.min(ZOOM_MAX, zoom * factor),
                    );
                    lastPinchRef.current = { ...prev, dist };
                    setZoom(newZoom);
                  } else if (e.touches.length === 1) {
                    handlePointerMove(
                      e.touches[0].clientX,
                      e.touches[0].clientY,
                    );
                  }
                }}
                onTouchEnd={(e: TouchEvent<HTMLCanvasElement>) => {
                  if (e.touches.length === 0) {
                    const last = lastPointerRef.current;
                    handlePointerUp(last?.clientX ?? 0, last?.clientY ?? 0);
                  } else if (e.touches.length === 1) {
                    lastPinchRef.current = null;
                  } else if (e.touches.length === 2) {
                    lastPinchRef.current = {
                      dist: Math.hypot(
                        e.touches[1].clientX - e.touches[0].clientX,
                        e.touches[1].clientY - e.touches[0].clientY,
                      ),
                      pan,
                      center: {
                        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                      },
                    };
                  }
                }}
                onTouchCancel={() => handlePointerUp(0, 0, true)}
                onContextMenu={handleContextMenu}
                className={`absolute inset-0 w-full h-full rounded-lg touch-none ${
                  effectiveMode === "test"
                    ? "cursor-default"
                    : effectiveMode === "buildings"
                      ? buildingAction === "move"
                        ? "cursor-move"
                        : buildingAction === "upgrade"
                          ? "cursor-pointer"
                          : "cursor-crosshair"
                      : "cursor-crosshair"
                }`}
              />
            </div>
          </div>

          <div className="flex-shrink-0 md:w-52 lg:w-60 rounded-lg bg-slate-800/90 px-3 py-2 text-xs text-slate-400 space-y-1">
            <p className="hidden md:block">
              <strong className="text-slate-300">Как играть:</strong> Клик по
              замку или бараку — панель улучшений. Колёсико мыши — зум,
              перетаскивание — движение карты.
            </p>
            <p className="md:hidden">
              <strong className="text-slate-300">Как играть:</strong> Нажмите на
              замок или барак — откроется панель улучшений. Два пальца — зум,
              один — движение карты.
            </p>
            <p>
              Золото копится со зданий, за убийство юнитов и зданий, и от
              захваченных нейтральных контрольных зон. Покупайте улучшения в
              замке и бараках. Воины идут по маршруту и атакуют врагов.
            </p>
          </div>
        </div>
      </div>

      {upgradePanelBuildingId &&
        state &&
        (() => {
          const entity = state.entities.find(
            (e) => e.id === upgradePanelBuildingId,
          );
          if (
            !entity ||
            (entity.kind !== "castle" && entity.kind !== "barrack")
          )
            return null;
          const rect = overlayCanvasRef.current?.getBoundingClientRect();
          if (!rect) return null;
          const vp = viewportRef.current;
          let left: number;
          let top: number;
          if (vp && vp.width > 0 && vp.height > 0) {
            const scale =
              Math.min(vp.width / vp.mapWidth, vp.height / vp.mapHeight) *
              vp.zoom;
            left = rect.left + (entity.position.x - vp.panX) * scale;
            top = rect.top + (entity.position.y - vp.panY) * scale;
          } else {
            left =
              rect.left + (entity.position.x / config.mapWidth) * rect.width;
            top =
              rect.top + (entity.position.y / config.mapHeight) * rect.height;
          }
          const playerState = state.playerStates[entity.ownerId];
          const barrackLevel = state.barrackLevels?.[entity.id] ?? 0;
          const barrackBuyCapacity = state.barrackBuyCapacity?.[entity.id];
          const barrackRepairCooldownMs =
            state.barrackRepairCooldownMs?.[entity.id] ?? 0;
          const barrackHeroCooldowns =
            state.barrackHeroCooldowns?.[entity.id] ?? {};
          const aliveHeroTypeIds = new Set(
            state.entities
              .filter(
                (e) => e.isHero && e.ownerId === entity.ownerId && e.isAlive,
              )
              .map((e) => e.heroTypeId!)
              .filter(Boolean),
          );
          return (
            <BuildingUpgradePanel
              entity={entity}
              config={config}
              currentPlayerId={playerId ?? selectedPlayerId}
              playerState={playerState}
              barrackLevel={barrackLevel}
              barrackBuyCapacity={barrackBuyCapacity}
              barrackRepairCooldownMs={barrackRepairCooldownMs}
              barrackHeroCooldowns={barrackHeroCooldowns}
              aliveHeroTypeIds={aliveHeroTypeIds}
              heroNames={heroNamesByPlayer[entity.ownerId]}
              onSummonHero={summonHero}
              position={{ left, top }}
              bounds={{
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
              }}
              isMobile={isMobile}
              onBuyCastleUpgrade={buyCastleUpgrade}
              onBuyBarrackUpgrade={buyBarrackUpgrade}
              onBuyBarrackWarrior={buyBarrackWarrior}
              onRepairBarrack={repairBarrack}
              onCastCastleSpell={castCastleSpell}
              onClose={() => {
                setUpgradePanelBuildingId(null);
                setSelectedNeutralPointId(null);
                setSelectedHeroId(null);
              }}
              gameOver={state.gameOver}
            />
          );
        })()}

      {effectiveMode === "test" &&
        selectedHeroId &&
        state &&
        (() => {
          const entity = state.entities.find((e) => e.id === selectedHeroId);
          if (!entity || !entity.isHero || !entity.heroTypeId) return null;
          const rect = overlayCanvasRef.current?.getBoundingClientRect();
          if (!rect) return null;
          const vp = viewportRef.current;
          let left: number;
          let top: number;
          if (vp && vp.width > 0 && vp.height > 0) {
            const scale =
              Math.min(vp.width / vp.mapWidth, vp.height / vp.mapHeight) *
              vp.zoom;
            left = rect.left + (entity.position.x - vp.panX) * scale;
            top = rect.top + (entity.position.y - vp.panY) * scale;
          } else {
            left =
              rect.left + (entity.position.x / config.mapWidth) * rect.width;
            top =
              rect.top + (entity.position.y / config.mapHeight) * rect.height;
          }
          const owner = config.players.find((p) => p.id === entity.ownerId);
          const names = {
            ...DEFAULT_HERO_NAMES,
            ...heroNamesByPlayer[entity.ownerId],
          };
          const displayName =
            names[entity.heroTypeId] ?? entity.heroTypeId ?? "Герой";
          const ownerShortLabel =
            owner?.id.replace("player-", "Игрок ") ?? entity.ownerId;
          return (
            <HeroStatsPanel
              entity={entity}
              displayName={displayName}
              ownerColor={owner?.color}
              ownerShortLabel={ownerShortLabel}
              position={{ left, top }}
              bounds={{
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
              }}
              isMobile={isMobile}
              onClose={() => setSelectedHeroId(null)}
            />
          );
        })()}

      {selectedNeutralPointId &&
        state?.neutralPoints &&
        (() => {
          const pt = state.neutralPoints.find(
            (p) => p.id === selectedNeutralPointId,
          );
          if (!pt) return null;
          const rect = overlayCanvasRef.current?.getBoundingClientRect();
          if (!rect) return null;
          const vp = viewportRef.current;
          let left: number;
          let top: number;
          if (vp && vp.width > 0 && vp.height > 0) {
            const scale =
              Math.min(vp.width / vp.mapWidth, vp.height / vp.mapHeight) *
              vp.zoom;
            left = rect.left + (pt.position.x - vp.panX) * scale;
            top = rect.top + (pt.position.y - vp.panY) * scale - 90;
          } else {
            left = rect.left + (pt.position.x / config.mapWidth) * rect.width;
            top =
              rect.top + (pt.position.y / config.mapHeight) * rect.height - 90;
          }
          left = Math.max(rect.left + 8, Math.min(rect.right - 220, left));
          top = Math.max(rect.top + 8, top);
          const goldPerSec =
            pt.goldIntervalMs > 0
              ? ((pt.goldPerInterval * 1000) / pt.goldIntervalMs).toFixed(1)
              : "0";
          const ownerPlayer = config.players.find((p) => p.id === pt.ownerId);
          return (
            <div
              className="absolute z-20 min-w-[200px] max-w-[260px] rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 shadow-xl"
              style={{ left, top }}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-slate-200">Точка захвата</h3>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNeutralPointId(null);
                    setSelectedHeroId(null);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="space-y-1 text-sm text-slate-400">
                <div>
                  <span className="text-slate-500">Золото:</span>{" "}
                  <span className="text-amber-400">+{pt.goldPerInterval}</span>{" "}
                  каждые {Math.round(pt.goldIntervalMs / 1000)} с ({goldPerSec}
                  /с)
                </div>
                <div>
                  <span className="text-slate-500">Владелец:</span>{" "}
                  {pt.ownerId ? (
                    <span style={{ color: ownerPlayer?.color ?? "#888" }}>
                      {ownerPlayer?.id ?? pt.ownerId}
                    </span>
                  ) : (
                    <span className="text-slate-500">нейтральная</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Радиус захвата:</span>{" "}
                  {pt.captureRadius}
                </div>
              </div>
            </div>
          );
        })()}

      {isDev && (
        <DevelopmentPanel
          config={config}
          playerStates={state?.playerStates ?? {}}
          selectedPlayerId={devPanelPlayerId}
          onSelectPlayer={setDevPanelPlayerId}
          gameOver={state?.gameOver}
          fogOfWarEnabled={fogOfWarEnabled}
          onToggleFogOfWar={toggleFogOfWar}
        />
      )}
    </div>
  );
}
