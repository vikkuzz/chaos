import { Entity, EntityProps } from "../Entity";
import { RouteManager } from "../../pathfinding/RouteManager";
import { Warrior } from "../units/Warrior";
import { WarriorStats, WarriorTypeId } from "../units/WarriorTypes";

export interface BarrackProps extends Omit<EntityProps, "kind"> {
  spawnIntervalMs: number;
  warriorTypeId: WarriorTypeId;
  warriorStats: WarriorStats;
  /** Применяет апгрейды игрока к базовым статам. Если не задан — используются warriorStats без изменений. */
  resolveStats?: (ownerId: string, baseStats: WarriorStats) => WarriorStats;
  routeManager?: RouteManager;
  onSpawnWarrior: (warrior: Warrior) => void;
  /** Если задан, спавн происходит только когда эта функция возвращает true (у игрока есть хотя бы одно здание). */
  canSpawn?: () => boolean;
}

/**
 * Барак — периодически спавнит воинов по заданному маршруту.
 */
export class Barrack extends Entity {
  public spawnIntervalMs: number;
  public spawnCount: number;
  public readonly baseMaxHp: number;
  public readonly baseSpawnIntervalMs: number;
  public readonly warriorTypeId: WarriorTypeId;
  public readonly warriorStats: WarriorStats;
  public readonly routeManager: RouteManager;

  private readonly resolveStats?: (ownerId: string, baseStats: WarriorStats) => WarriorStats;
  private readonly onSpawnWarrior: (warrior: Warrior) => void;
  private readonly canSpawn: () => boolean;
  private spawnTimerMs = 0;

  constructor(props: BarrackProps) {
    super({
      ...props,
      kind: "barrack",
    });

    this.spawnIntervalMs = props.spawnIntervalMs;
    this.spawnCount = 1;
    this.baseMaxHp = props.maxHp;
    this.baseSpawnIntervalMs = props.spawnIntervalMs;
    this.warriorTypeId = props.warriorTypeId;
    this.warriorStats = props.warriorStats;
    this.resolveStats = props.resolveStats;
    this.routeManager = props.routeManager ?? new RouteManager();
    this.onSpawnWarrior = props.onSpawnWarrior;
    this.canSpawn = props.canSpawn ?? (() => true);
  }

  update(deltaTimeMs: number): void {
    this.spawnTimerMs += deltaTimeMs;

    const effectiveInterval = this.isAlive
      ? this.spawnIntervalMs
      : this.spawnIntervalMs * 2;

    while (this.spawnTimerMs >= effectiveInterval) {
      this.spawnTimerMs -= effectiveInterval;
      if (this.canSpawn()) {
        for (let i = 0; i < this.spawnCount; i++) {
          this.spawnUnit(i);
        }
      }
    }
  }

  /** Радиус круга спавна — воины появляются по окружности вокруг барака. */
  private static readonly SPAWN_OFFSET_RADIUS = 8;

  /**
   * Создаёт нового воина и регистрирует его через колбэк Game.
   * @param spawnIndex — индекс в текущем цикле (0..spawnCount-1), для смещения по кругу.
   */
  private spawnUnit(spawnIndex: number): void {
    const stats = this.resolveStats
      ? this.resolveStats(this.ownerId, this.warriorStats)
      : this.warriorStats;

    const position = this.getSpawnPosition(spawnIndex);

    const warrior = new Warrior({
      id: `${this.id}-warrior-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ownerId: this.ownerId,
      position,
      radius: 4,
      stats,
      baseWarriorTypeId: this.warriorTypeId,
      routeManager: this.routeManager,
    });

    this.onSpawnWarrior(warrior);
  }

  /** Позиция спавна воина: центр при 1 воине, по кругу при нескольких. */
  private getSpawnPosition(spawnIndex: number): { x: number; y: number } {
    if (this.spawnCount <= 1) {
      return { x: this.position.x, y: this.position.y };
    }
    const angle = (2 * Math.PI * spawnIndex) / this.spawnCount;
    return {
      x: this.position.x + Barrack.SPAWN_OFFSET_RADIUS * Math.cos(angle),
      y: this.position.y + Barrack.SPAWN_OFFSET_RADIUS * Math.sin(angle),
    };
  }

  /**
   * Применяет улучшения к бараку.
   * @param globalHpMult — множитель HP от глобальных улучшений (stone-walls, fortress)
   * @param barrackHpMult — множитель HP от улучшений барака (barrack-reinforce)
   * @param spawnSpeedMult — множитель скорости спавна (faster-recruit)
   * @param spawnCount — число воинов за один цикл спавна (extra-recruit)
   */
  applyUpgrades(
    globalHpMult: number,
    barrackHpMult: number,
    spawnSpeedMult: number,
    spawnCount: number,
  ): void {
    const totalHp = Math.round(this.baseMaxHp * globalHpMult * barrackHpMult);
    this.applyMaxHpChange(totalHp);
    this.spawnIntervalMs = Math.round(this.baseSpawnIntervalMs * spawnSpeedMult);
    this.spawnCount = Math.max(1, spawnCount);
  }

  setRouteFromConfig(configs: { x: number; y: number }[]): void {
    this.routeManager.setWaypoints(
      configs.map((c) => ({ x: c.x, y: c.y })),
    );
  }
}
