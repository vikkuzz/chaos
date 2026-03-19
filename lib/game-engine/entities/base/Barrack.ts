import { Entity, EntityProps } from "../Entity";
import { RouteManager } from "../../pathfinding/RouteManager";
import { getUniqueWarriorTypeIdsInOrder } from "../../upgrades/definitions";
import { Warrior } from "../units/Warrior";
import { WarriorStats, WarriorTypeId } from "../units/WarriorTypes";

export interface BarrackProps extends Omit<EntityProps, "kind"> {
  spawnIntervalMs: number;
  /** Типы воинов за цикл спавна. При spawnCount > length цикл повторяется (0,1,0,1...). */
  warriorTypeIds: readonly WarriorTypeId[];
  /** Применяет апгрейды игрока к базовым статам типа. */
  resolveStatsForType: (ownerId: string, typeId: WarriorTypeId) => WarriorStats;
  routeManager?: RouteManager;
  onSpawnWarrior: (warrior: Warrior) => void;
  /** Если задан, спавн происходит только когда эта функция возвращает true (у игрока есть хотя бы одно здание). */
  canSpawn?: () => boolean;
  /** Дальняя атака по врагам в радиусе. */
  attackRange?: number;
  attackDamage?: number;
  attackIntervalMs?: number;
}

/**
 * Барак — периодически спавнит воинов по заданному маршруту.
 */
export class Barrack extends Entity {
  public spawnIntervalMs: number;
  public spawnCount: number;
  public readonly baseMaxHp: number;
  public readonly baseSpawnIntervalMs: number;
  public readonly warriorTypeIds: readonly WarriorTypeId[];
  /** Уникальные типы в порядке первого вхождения — хвост волны при апгрейде барака. */
  public readonly uniqueWarriorTypeIds: readonly WarriorTypeId[];
  public readonly routeManager: RouteManager;

  public readonly attackRange: number;
  public attackDamage: number;
  public readonly baseAttackDamage: number;
  public readonly attackIntervalMs: number;
  public attackCooldownMs = 0;

  private readonly resolveStatsForType: (ownerId: string, typeId: WarriorTypeId) => WarriorStats;
  private readonly onSpawnWarrior: (warrior: Warrior) => void;
  private readonly canSpawn: () => boolean;
  /** Таймер до следующего спавна. Инициализирован интервалом — первый спавн сразу. */
  private spawnTimerMs: number;

  /** Лимит докупки воинов: текущее и макс. значение. Восстанавливается по таймауту. */
  private buyCapacityCurrent = 1;
  private buyCapacityMax = 1;
  private buyCapacityRestoreTimerMs = 0;
  private static readonly BUY_CAPACITY_RESTORE_INTERVAL_MS = 20000;

  /** Откат ремонта (мс до следующего доступного ремонта). */
  private repairCooldownMs = 0;
  private static readonly REPAIR_COOLDOWN_MS = 120000; // 2 минуты
  private static readonly REPAIR_HP_RATIO = 0.2; // 20% от макс. HP

  constructor(props: BarrackProps) {
    super({
      ...props,
      kind: "barrack",
    });

    this.spawnIntervalMs = props.spawnIntervalMs;
    this.spawnCount = props.warriorTypeIds.length;
    this.baseMaxHp = props.maxHp;
    this.baseSpawnIntervalMs = props.spawnIntervalMs;
    this.warriorTypeIds = props.warriorTypeIds;
    this.uniqueWarriorTypeIds = getUniqueWarriorTypeIdsInOrder(props.warriorTypeIds);
    this.resolveStatsForType = props.resolveStatsForType;
    this.routeManager = props.routeManager ?? new RouteManager();
    this.onSpawnWarrior = props.onSpawnWarrior;
    this.canSpawn = props.canSpawn ?? (() => true);
    this.spawnTimerMs = props.spawnIntervalMs; // Первый спавн сразу, следующие — по интервалу
    this.attackRange = props.attackRange ?? 0;
    this.baseAttackDamage = props.attackDamage ?? 0;
    this.attackDamage = this.baseAttackDamage;
    this.attackIntervalMs = props.attackIntervalMs ?? 600;
  }

  update(deltaTimeMs: number): void {
    this.attackCooldownMs = Math.max(0, this.attackCooldownMs - deltaTimeMs);
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

    // Восстановление лимита докупки воинов
    if (this.buyCapacityCurrent < this.buyCapacityMax) {
      this.buyCapacityRestoreTimerMs += deltaTimeMs;
      while (
        this.buyCapacityCurrent < this.buyCapacityMax &&
        this.buyCapacityRestoreTimerMs >= Barrack.BUY_CAPACITY_RESTORE_INTERVAL_MS
      ) {
        this.buyCapacityRestoreTimerMs -= Barrack.BUY_CAPACITY_RESTORE_INTERVAL_MS;
        this.buyCapacityCurrent += 1;
      }
    } else {
      this.buyCapacityRestoreTimerMs = 0;
    }

    // Откат ремонта
    if (this.repairCooldownMs > 0) {
      this.repairCooldownMs = Math.max(0, this.repairCooldownMs - deltaTimeMs);
    }
  }

  /** Ремонт на 20% HP. Бесплатно, откат 2 мин. Возвращает true, если ремонт выполнен. */
  repair(): boolean {
    if (!this.isAlive || this.repairCooldownMs > 0) return false;
    const healAmount = Math.round(this.maxHp * Barrack.REPAIR_HP_RATIO);
    this.heal(healAmount);
    this.repairCooldownMs = Barrack.REPAIR_COOLDOWN_MS;
    return true;
  }

  getRepairCooldownMs(): number {
    return this.repairCooldownMs;
  }

  /** Оставшееся время (мс) до следующего спавна. */
  getRemainingSpawnMs(): number {
    const effective = this.isAlive ? this.spawnIntervalMs : this.spawnIntervalMs * 2;
    return this.spawnTimerMs >= effective ? 0 : effective - this.spawnTimerMs;
  }

  /** Радиус круга спавна — воины появляются по окружности вокруг барака. */
  private static readonly SPAWN_OFFSET_RADIUS = 8;

  /**
   * Создаёт нового воина и регистрирует его через колбэк Game.
   * @param spawnIndex — индекс в текущем цикле (0..spawnCount-1), для смещения по кругу.
   */
  private spawnUnit(spawnIndex: number): void {
    const baseLen = this.warriorTypeIds.length;
    const typeId =
      spawnIndex < baseLen
        ? this.warriorTypeIds[spawnIndex]
        : (this.uniqueWarriorTypeIds[
            (spawnIndex - baseLen) % Math.max(1, this.uniqueWarriorTypeIds.length)
          ] ?? this.warriorTypeIds[0]);
    const stats = this.resolveStatsForType(this.ownerId, typeId);
    const position = this.getSpawnPosition(spawnIndex);

    const warrior = new Warrior({
      id: `${this.id}-warrior-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ownerId: this.ownerId,
      position,
      radius: 4,
      stats,
      baseWarriorTypeId: typeId,
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

  /** Здания получают на 20% меньше урона. */
  takeDamage(amount: number): void {
    super.takeDamage(Math.round(amount * 0.8));
  }

  /**
   * Применяет улучшения к бараку (уровневая система).
   * @param globalHpMult — множитель HP от глобальных улучшений замка
   * @param barrackHpMult — множитель HP от уровня барака
   * @param barrackAttackMult — множитель атаки от уровня барака
   * @param spawnSpeedMult — множитель скорости спавна (0.9^level)
   * @param spawnCount — число воинов за цикл (паттерн + уровень × число уникальных типов)
   * @param buyCapacity — макс. слотов докупки (как spawnCount)
   */
  applyUpgrades(
    globalHpMult: number,
    barrackHpMult: number,
    barrackAttackMult: number,
    spawnSpeedMult: number,
    spawnCount: number,
    buyCapacity: number,
  ): void {
    const totalHp = Math.round(this.baseMaxHp * globalHpMult * barrackHpMult);
    this.applyMaxHpChange(totalHp);
    this.attackDamage = Math.round(this.baseAttackDamage * barrackAttackMult);
    this.spawnIntervalMs = Math.round(this.baseSpawnIntervalMs * spawnSpeedMult);
    this.spawnCount = Math.max(1, spawnCount);
    this.buyCapacityMax = buyCapacity;
    if (this.buyCapacityCurrent > this.buyCapacityMax) {
      this.buyCapacityCurrent = this.buyCapacityMax;
    }
  }

  getBuyCapacity(): {
    current: number;
    max: number;
    restoreRemainingMs: number;
  } {
    const restoreRemainingMs =
      this.buyCapacityCurrent >= this.buyCapacityMax
        ? 0
        : Math.max(
            0,
            Barrack.BUY_CAPACITY_RESTORE_INTERVAL_MS -
              this.buyCapacityRestoreTimerMs,
          );
    return {
      current: this.buyCapacityCurrent,
      max: this.buyCapacityMax,
      restoreRemainingMs,
    };
  }

  /** Потребляет 1 слот докупки. Возвращает true, если слот был доступен. */
  consumeBuyCapacity(): boolean {
    if (this.buyCapacityCurrent <= 0) return false;
    this.buyCapacityCurrent -= 1;
    this.buyCapacityRestoreTimerMs = 0;
    return true;
  }

  /** Индекс следующего типа при докупке (циклически по warriorTypeIds). */
  private nextBuySpawnIndex = 0;

  /** Спавнит одного воина (для докупки за золото). Типы чередуются. */
  spawnBuyWarrior(): void {
    const idx = this.nextBuySpawnIndex % this.warriorTypeIds.length;
    this.nextBuySpawnIndex = (idx + 1) % this.warriorTypeIds.length;
    this.spawnUnit(idx);
  }

  setRouteFromConfig(configs: { x: number; y: number }[]): void {
    this.routeManager.setWaypoints(
      configs.map((c) => ({ x: c.x, y: c.y })),
    );
  }
}
