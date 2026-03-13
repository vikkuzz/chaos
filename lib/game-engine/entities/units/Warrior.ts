import { Entity, EntityProps } from "../Entity";
import { RouteManager } from "../../pathfinding/RouteManager";
import { WarriorStats } from "./WarriorTypes";

export interface WarriorProps extends Omit<EntityProps, "kind" | "maxHp"> {
  stats: WarriorStats;
  /** ID базового типа воина для повторного применения апгрейдов. */
  baseWarriorTypeId: string;
  routeManager: RouteManager;
}

/**
 * Базовый воин, который движется по маршруту и атакует врагов.
 * Логика движения и атаки в MovementSystem.
 */
export class Warrior extends Entity {
  public stats: WarriorStats;
  public readonly baseWarriorTypeId: string;
  public readonly routeManager: RouteManager;
  public currentWaypointIndex: number;
  /** Таймер до следующей атаки (мс). */
  public attackCooldownMs = 0;

  constructor(props: WarriorProps) {
    super({
      ...props,
      kind: "warrior",
      maxHp: props.stats.maxHp,
    });

    this.stats = props.stats;
    this.baseWarriorTypeId = props.baseWarriorTypeId;
    this.routeManager = props.routeManager;
    this.currentWaypointIndex = 0;
  }

  /**
   * Применить улучшенные статы (при покупке апгрейда).
   * Обновляет stats и maxHp, сохраняя долю текущего HP.
   */
  applyUpgradedStats(newStats: WarriorStats): void {
    this.stats = newStats;
    this.applyMaxHpChange(newStats.maxHp);
  }

  update(deltaTimeMs: number): void {
    this.attackCooldownMs = Math.max(0, this.attackCooldownMs - deltaTimeMs);
  }
}
