import { Renderer, type FogData } from "./Renderer";
import { GameStateSnapshot, type EntitySnapshot, type SpellEffect } from "../core/Game";
import { isPointInCells, FOG_CELL_SIZE } from "../fog/FogOfWar";

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;
}

/**
 * Простая реализация Renderer через Canvas 2D.
 * Поддерживает viewport: canvas размера width x height, рендерим карту с pan/zoom.
 */
export class CanvasRenderer implements Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly playerColors: Map<string, string>;
  // showRoutes можно использовать позже для отрисовки маршрутов
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly showRoutes: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    options?: { showRoutes?: boolean; playerColors?: Record<string, string> },
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CanvasRenderer: не удалось получить 2D контекст.");
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.showRoutes = options?.showRoutes ?? false;
    const colors = options?.playerColors ?? {};
    this.playerColors = new Map(Object.entries(colors));
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(
    state: GameStateSnapshot,
    viewport?: ViewportState | null,
    currentPlayerId?: string | null,
    fogData?: FogData | null,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mapW = viewport?.mapWidth ?? 998;
    const mapH = viewport?.mapHeight ?? 998;

    ctx.clearRect(0, 0, w, h);

    if (viewport && viewport.width > 0 && viewport.height > 0) {
      const scale =
        Math.min(viewport.width / viewport.mapWidth, viewport.height / viewport.mapHeight) *
        viewport.zoom;
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, -viewport.panX * scale, -viewport.panY * scale);
    }

    const useFog = fogData && currentPlayerId;

    // Нейтральные точки
    for (const pt of state.neutralPoints ?? []) {
      if (useFog) {
        const inVisible = isPointInCells(pt.position.x, pt.position.y, fogData.visibleCells, FOG_CELL_SIZE);
        const inRevealed = isPointInCells(pt.position.x, pt.position.y, fogData.revealedCells, FOG_CELL_SIZE);
        if (!inVisible && !inRevealed) continue;
        this.drawNeutralPoint(pt, inVisible ? 1 : 0.4);
      } else {
        this.drawNeutralPoint(pt, 1);
      }
    }

    // Сущности: свои всегда, чужие — только в visible
    for (const entity of state.entities) {
      if (!entity.isAlive) continue;
      const isOwn = entity.ownerId === currentPlayerId;
      if (useFog && !isOwn) {
        const inVisible = isPointInCells(entity.position.x, entity.position.y, fogData.visibleCells, FOG_CELL_SIZE);
        if (!inVisible) continue;
      }
      this.drawEntity(entity, currentPlayerId, 1);
    }

    // Last-known враги в сером fog
    if (useFog) {
      for (const entity of fogData.lastKnownEnemies.values()) {
        const inVisible = isPointInCells(entity.position.x, entity.position.y, fogData.visibleCells, FOG_CELL_SIZE);
        if (inVisible) continue;
        const inRevealed = isPointInCells(entity.position.x, entity.position.y, fogData.revealedCells, FOG_CELL_SIZE);
        if (!inRevealed) continue;
        this.drawEntity(entity, currentPlayerId, 0.5, true);
      }
    }

    this.drawAttackEffects(
      state.attackEffects ?? [],
      state.timeMs,
      useFog ? fogData! : null,
      mapW,
      mapH,
    );
    this.drawSpellEffects(state.spellEffects ?? [], state.timeMs, useFog ? fogData! : null, mapW, mapH);

    // Fog overlay
    if (useFog) {
      this.drawFogOverlay(mapW, mapH, fogData);
    }

    if (viewport) {
      ctx.restore();
    }
  }

  private drawFogOverlay(mapW: number, mapH: number, fog: FogData): void {
    const { ctx } = this;
    const cellSize = FOG_CELL_SIZE;
    const cols = Math.ceil(mapW / cellSize);
    const rows = Math.ceil(mapH / cellSize);

    ctx.save();
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const key = `${cx},${cy}`;
        if (fog.visibleCells.has(key)) continue;
        const x = cx * cellSize;
        const y = cy * cellSize;
        ctx.fillStyle = fog.revealedCells.has(key)
          ? "rgba(0, 0, 0, 0.5)"
          : "rgba(0, 0, 0, 0.9)";
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
    ctx.restore();
  }

  private drawAttackEffects(
    effects: readonly { from: { x: number; y: number }; to: { x: number; y: number }; timeMs: number }[],
    currentTimeMs: number,
    fogData?: FogData | null,
    _mapW?: number,
    _mapH?: number,
  ): void {
    const { ctx } = this;
    const durationMs = 180;
    const travelMs = 60;

    for (const effect of effects) {
      const age = currentTimeMs - effect.timeMs;
      if (age >= durationMs) continue;
      if (fogData) {
        const fromVisible = isPointInCells(effect.from.x, effect.from.y, fogData.visibleCells, FOG_CELL_SIZE);
        const toVisible = isPointInCells(effect.to.x, effect.to.y, fogData.visibleCells, FOG_CELL_SIZE);
        if (!fromVisible && !toVisible) continue;
      }

      const progress = Math.min(1, age / travelMs);
      const fade = 1 - (age / durationMs) * (age / durationMs);

      const fromX = effect.from.x;
      const fromY = effect.from.y;
      const toX = effect.from.x + (effect.to.x - effect.from.x) * progress;
      const toY = effect.from.y + (effect.to.y - effect.from.y) * progress;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 200, 80, ${fade * 0.9})`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(255, 180, 50, 0.8)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      if (progress >= 1) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255, 220, 100, ${fade * 0.6})`;
        ctx.beginPath();
        ctx.arc(effect.to.x, effect.to.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawSpellEffects(
    effects: readonly SpellEffect[],
    currentTimeMs: number,
    fogData?: FogData | null,
    _mapW?: number,
    _mapH?: number,
  ): void {
    const { ctx } = this;
    const durationMs = 800;
    const expandMs = 350;

    for (const effect of effects) {
      const age = currentTimeMs - effect.timeMs;
      if (age >= durationMs) continue;
      if (fogData) {
        const posVisible = isPointInCells(
          effect.position.x,
          effect.position.y,
          fogData.visibleCells,
          FOG_CELL_SIZE,
        );
        if (!posVisible) continue;
      }

      const expandProgress = Math.min(1, age / expandMs);
      const fade = 1 - (age / durationMs) * (age / durationMs);
      const alpha = 0.4 * fade;

      const color = this.playerColors.get(effect.ownerId) ?? "#8b5cf6";
      const rgb = color.startsWith("#") ? color.slice(1) : "8b5cf6";
      const rv = parseInt(rgb.slice(0, 2), 16);
      const gv = parseInt(rgb.slice(2, 4), 16);
      const bv = parseInt(rgb.slice(4, 6), 16);

      ctx.save();
      ctx.strokeStyle = `rgba(${rv}, ${gv}, ${bv}, ${alpha})`;
      ctx.fillStyle = `rgba(${rv}, ${gv}, ${bv}, ${alpha * 0.15})`;
      ctx.lineWidth = 4;

      if (effect.rectWidth != null && effect.rectHeight != null) {
        const w = effect.rectWidth * expandProgress;
        const h = effect.rectHeight * expandProgress;
        const x = effect.position.x - w / 2;
        const y = effect.position.y - h / 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillRect(x, y, w, h);
      } else {
        const r = effect.radius * expandProgress;
        ctx.beginPath();
        ctx.arc(effect.position.x, effect.position.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  destroy(): void {
    // Пока специальных ресурсов нет.
  }

  private hexToRgba(hex: string, alpha: number): string {
    const rgb = hex.startsWith("#") ? hex.slice(1) : hex;
    const r = parseInt(rgb.slice(0, 2), 16);
    const g = parseInt(rgb.slice(2, 4), 16);
    const b = parseInt(rgb.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private drawNeutralPoint(
    pt: { position: { x: number; y: number }; radius: number; captureRadius?: number; ownerId: string | null },
    alpha = 1,
  ): void {
    const { ctx } = this;
    const { x, y } = pt.position;
    const r = pt.radius;
    const captureR = pt.captureRadius ?? r * 0.6;

    const baseColor = pt.ownerId
      ? this.playerColors.get(pt.ownerId) ?? "#888888"
      : "#6b7280";

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.hexToRgba(baseColor, 0.18);
    ctx.strokeStyle = this.hexToRgba(baseColor, 0.45);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = this.hexToRgba(baseColor, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, captureR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawEntity(
    entity: EntitySnapshot,
    currentPlayerId?: string | null,
    alpha = 1,
    simplified = false,
  ): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    const isCurrentPlayerBuilding =
      currentPlayerId &&
      (entity.kind === "castle" || entity.kind === "barrack" || entity.kind === "tower") &&
      entity.ownerId === currentPlayerId;

    switch (entity.kind) {
      case "castle":
        ctx.fillStyle = isCurrentPlayerBuilding
          ? (this.playerColors.get(entity.ownerId) ?? "#ffffff")
          : "#ffffff";
        break;
      case "barrack":
        ctx.fillStyle = isCurrentPlayerBuilding
          ? (this.playerColors.get(entity.ownerId) ?? "#cccccc")
          : "#cccccc";
        break;
      case "tower":
        ctx.fillStyle = isCurrentPlayerBuilding
          ? (this.playerColors.get(entity.ownerId) ?? "#999999")
          : "#999999";
        break;
      case "warrior":
        ctx.fillStyle = this.playerColors.get(entity.ownerId) ?? "#ff0000";
        break;
      default:
        ctx.fillStyle = "#666666";
    }

    const { x, y } = entity.position;
    const r = entity.radius;

    if (simplified) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (entity.kind === "warrior") {
      if (entity.isHero) {
        // Герой — звёздчатая форма с золотой обводкой
        const color = this.playerColors.get(entity.ownerId) ?? "#ff0000";
        ctx.fillStyle = color;
        ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4 - Math.PI / 2;
          const xx = x + r * Math.cos(angle);
          const yy = y + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (entity.baseWarriorTypeId === "archer") {
        // Лучник — ромб (стрелок)
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (isCurrentPlayerBuilding) {
        const color = this.playerColors.get(entity.ownerId) ?? "#8b5cf6";
        ctx.strokeStyle = this.hexToRgba(color, 0.9);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }

    // Полоска HP над сущностью.
    const hpBarOffset = entity.isHero && entity.level !== undefined ? 14 : 8;
    if (entity.maxHp > 0) {
      const barWidth = entity.radius * 2;
      const barHeight = 3;
      const healthRatio = entity.hp / entity.maxHp;
      const hpBarY = entity.position.y - entity.radius - hpBarOffset;

      ctx.fillStyle = "#000000";
      ctx.fillRect(
        entity.position.x - entity.radius,
        hpBarY,
        barWidth,
        barHeight,
      );

      ctx.fillStyle = "#00ff00";
      ctx.fillRect(
        entity.position.x - entity.radius,
        hpBarY,
        barWidth * healthRatio,
        barHeight,
      );
    }

    // Уровень над героем (выше полоски HP).
    if (entity.isHero && entity.level !== undefined) {
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = "#ffd700";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = `Lv.${entity.level}`;
      const levelY = entity.position.y - entity.radius - (entity.maxHp > 0 ? 28 : 12);
      ctx.strokeText(text, entity.position.x, levelY);
      ctx.fillText(text, entity.position.x, levelY);
    }
    ctx.restore();
  }
}
