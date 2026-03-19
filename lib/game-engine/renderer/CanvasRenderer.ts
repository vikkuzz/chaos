import { Renderer } from "./Renderer";
import { GameStateSnapshot, type EntitySnapshot, type SpellEffect } from "../core/Game";

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

    // Нейтральные точки рисуем первыми (под юнитами), полупрозрачные
    for (const pt of state.neutralPoints ?? []) {
      this.drawNeutralPoint(pt);
    }

    for (const entity of state.entities) {
      if (!entity.isAlive) continue;
      this.drawEntity(entity);
    }

    this.drawAttackEffects(state.attackEffects ?? [], state.timeMs);
    this.drawSpellEffects(state.spellEffects ?? [], state.timeMs);

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

  private drawSpellEffects(effects: readonly SpellEffect[], currentTimeMs: number): void {
    const { ctx } = this;
    const durationMs = 800;
    const expandMs = 350;

    for (const effect of effects) {
      const age = currentTimeMs - effect.timeMs;
      if (age >= durationMs) continue;

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

  private drawNeutralPoint(pt: { position: { x: number; y: number }; radius: number; captureRadius?: number; ownerId: string | null }): void {
    const { ctx } = this;
    const { x, y } = pt.position;
    const r = pt.radius;
    const captureR = pt.captureRadius ?? r * 0.6;

    const baseColor = pt.ownerId
      ? this.playerColors.get(pt.ownerId) ?? "#888888"
      : "#6b7280";

    ctx.save();
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

    const { x, y } = entity.position;
    const r = entity.radius;

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
  }
}
