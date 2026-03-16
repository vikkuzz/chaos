import { Renderer } from "./Renderer";
import { GameStateSnapshot, type EntitySnapshot } from "../core/Game";

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

  render(state: GameStateSnapshot, viewport?: ViewportState | null): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (viewport && viewport.width > 0 && viewport.height > 0) {
      const scale =
        Math.min(viewport.width / viewport.mapWidth, viewport.height / viewport.mapHeight) *
        viewport.zoom;
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, -viewport.panX * scale, -viewport.panY * scale);
    }

    for (const entity of state.entities) {
      if (!entity.isAlive) continue;
      this.drawEntity(entity);
    }

    for (const pt of state.neutralPoints ?? []) {
      this.drawNeutralPoint(pt);
    }

    this.drawAttackEffects(state.attackEffects ?? [], state.timeMs);

    if (viewport) {
      ctx.restore();
    }
  }

  private drawAttackEffects(effects: readonly { from: { x: number; y: number }; to: { x: number; y: number }; timeMs: number }[], currentTimeMs: number): void {
    const { ctx } = this;
    const durationMs = 180;
    const travelMs = 60;

    for (const effect of effects) {
      const age = currentTimeMs - effect.timeMs;
      if (age >= durationMs) continue;

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

  destroy(): void {
    // Пока специальных ресурсов нет.
  }

  private drawNeutralPoint(pt: { position: { x: number; y: number }; radius: number; ownerId: string | null }): void {
    const { ctx } = this;
    const { x, y } = pt.position;
    const r = pt.radius;

    ctx.fillStyle = pt.ownerId
      ? this.playerColors.get(pt.ownerId) ?? "#888888"
      : "#6b7280";
    ctx.strokeStyle = pt.ownerId ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawEntity(entity: EntitySnapshot): void {
    const { ctx } = this;

    switch (entity.kind) {
      case "castle":
        ctx.fillStyle = "#ffffff";
        break;
      case "barrack":
        ctx.fillStyle = "#cccccc";
        break;
      case "tower":
        ctx.fillStyle = "#999999";
        break;
      case "warrior":
        ctx.fillStyle = this.playerColors.get(entity.ownerId) ?? "#ff0000";
        break;
      default:
        ctx.fillStyle = "#666666";
    }

    ctx.beginPath();
    ctx.arc(entity.position.x, entity.position.y, entity.radius, 0, Math.PI * 2);
    ctx.fill();

    // Полоска HP над сущностью.
    if (entity.maxHp > 0) {
      const barWidth = entity.radius * 2;
      const barHeight = 3;
      const healthRatio = entity.hp / entity.maxHp;

      ctx.fillStyle = "#000000";
      ctx.fillRect(
        entity.position.x - entity.radius,
        entity.position.y - entity.radius - 8,
        barWidth,
        barHeight,
      );

      ctx.fillStyle = "#00ff00";
      ctx.fillRect(
        entity.position.x - entity.radius,
        entity.position.y - entity.radius - 8,
        barWidth * healthRatio,
        barHeight,
      );
    }
  }
}
