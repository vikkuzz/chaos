import type { EntitySnapshot } from "../core/Game";

/** Радиусы обзора зданий для тумана войны. */
export const VISION_CASTLE = 140;
export const VISION_BARRACK = 80;
export const VISION_TOWER = 100;
/** Воины/герои: detectionRadius из статов (80–90). */
export const FOG_CELL_SIZE = 32;

export interface VisionSource {
  x: number;
  y: number;
  radius: number;
}

/**
 * Собирает источники обзора для игрока из снимка сущностей.
 * Живые сущности игрока (замок, бараки, башни, воины, герои) дают обзор.
 */
export function getVisionSources(
  entities: readonly EntitySnapshot[],
  currentPlayerId: string,
): VisionSource[] {
  const sources: VisionSource[] = [];
  for (const e of entities) {
    if (e.ownerId !== currentPlayerId || !e.isAlive) continue;
    const r = e.visionRadius ?? 0;
    if (r <= 0) continue;
    sources.push({
      x: e.position.x,
      y: e.position.y,
      radius: r,
    });
  }
  return sources;
}

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/**
 * Вычисляет множество видимых клеток по источникам обзора.
 * Клетка видима, если её центр попадает в радиус хотя бы одного источника.
 * @param cellSize Размер клетки в мировых единицах (24–32).
 */
export function computeVisibleCells(
  sources: VisionSource[],
  mapWidth: number,
  mapHeight: number,
  cellSize: number,
): Set<string> {
  const visible = new Set<string>();
  const cols = Math.ceil(mapWidth / cellSize);
  const rows = Math.ceil(mapHeight / cellSize);

  for (const src of sources) {
    const r = src.radius;
    const r2 = r * r;
    const minCx = Math.max(0, Math.floor((src.x - r) / cellSize));
    const maxCx = Math.min(cols - 1, Math.floor((src.x + r) / cellSize));
    const minCy = Math.max(0, Math.floor((src.y - r) / cellSize));
    const maxCy = Math.min(rows - 1, Math.floor((src.y + r) / cellSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const cellCenterX = (cx + 0.5) * cellSize;
        const cellCenterY = (cy + 0.5) * cellSize;
        const dx = cellCenterX - src.x;
        const dy = cellCenterY - src.y;
        if (dx * dx + dy * dy <= r2) {
          visible.add(cellKey(cx, cy));
        }
      }
    }
  }
  return visible;
}

/**
 * Проверяет, попадает ли точка (x, y) в видимую или исследованную область.
 */
export function isPointInCells(
  x: number,
  y: number,
  cells: Set<string>,
  cellSize: number,
): boolean {
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  return cells.has(`${cx},${cy}`);
}

/** Возвращает ключ клетки для точки (x, y). */
export function getCellKey(x: number, y: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
}

/**
 * Обновляет карту последних известных вражеских сущностей.
 * Видимые враги — обновить; невидимые — оставить старые; мёртвые — удалить.
 */
export function updateLastKnownEnemies(
  entities: readonly EntitySnapshot[],
  currentPlayerId: string,
  visibleCells: Set<string>,
  cellSize: number,
  prev: Map<string, EntitySnapshot>,
): Map<string, EntitySnapshot> {
  const next = new Map<string, EntitySnapshot>();

  for (const e of entities) {
    if (e.ownerId === currentPlayerId) continue;
    if (!e.isAlive) continue;
    const inVisible = isPointInCells(e.position.x, e.position.y, visibleCells, cellSize);
    if (inVisible) {
      next.set(e.id, { ...e });
    } else if (prev.has(e.id)) {
      next.set(e.id, prev.get(e.id)!);
    }
  }

  return next;
}
