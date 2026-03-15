import { Point, PointLike } from "../utils/Point";
import type { NeutralPointConfig } from "../config/defaultConfig";

export interface NeutralPointSnapshot {
  id: string;
  position: { x: number; y: number };
  radius: number;
  captureRadius: number;
  ownerId: string | null;
  goldPerInterval: number;
  goldIntervalMs: number;
}

/**
 * Нейтральная точка захвата. Принадлежит игроку, чьи воины
 * прошли рядом последними. Даёт бонусное золото по таймауту.
 */
export class NeutralPoint {
  public readonly id: string;
  public position: Point;
  public readonly radius: number;
  public readonly captureRadius: number;
  public ownerId: string | null = null;
  public readonly goldPerInterval: number;
  public readonly goldIntervalMs: number;

  private goldTimerMs = 0;

  constructor(config: NeutralPointConfig) {
    this.id = config.id;
    this.position = Point.from(config.position);
    this.radius = config.radius;
    this.captureRadius = config.captureRadius;
    this.goldPerInterval = config.goldPerInterval;
    this.goldIntervalMs = config.goldIntervalMs;
  }

  /**
   * Пытается захватить точку воином. Если воин в радиусе захвата — ownerId обновляется.
   */
  tryCapture(warriorPosition: PointLike, warriorOwnerId: string): void {
    const dist = this.position.distanceTo(warriorPosition);
    if (dist <= this.captureRadius) {
      this.ownerId = warriorOwnerId;
    }
  }

  /**
   * Обновляет таймер золота. Возвращает золото владельцу, если интервал прошёл.
   */
  update(deltaTimeMs: number): { playerId: string; gold: number } | null {
    if (!this.ownerId) return null;

    this.goldTimerMs += deltaTimeMs;
    if (this.goldTimerMs >= this.goldIntervalMs) {
      this.goldTimerMs -= this.goldIntervalMs;
      return { playerId: this.ownerId, gold: this.goldPerInterval };
    }
    return null;
  }

  toSnapshot(): NeutralPointSnapshot {
    return {
      id: this.id,
      position: { x: this.position.x, y: this.position.y },
      radius: this.radius,
      captureRadius: this.captureRadius,
      ownerId: this.ownerId,
      goldPerInterval: this.goldPerInterval,
      goldIntervalMs: this.goldIntervalMs,
    };
  }
}
