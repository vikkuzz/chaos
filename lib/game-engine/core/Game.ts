import { GameConfig, type NeutralPointConfig } from "../config/defaultConfig";
import { Entity, EntityId } from "../entities/Entity";
import { Barrack } from "../entities/base/Barrack";
import { Castle } from "../entities/base/Castle";
import { Tower } from "../entities/base/Tower";
import { Warrior } from "../entities/units/Warrior";
import { MovementSystem } from "../pathfinding/MovementSystem";
import { CombatSystem } from "../combat/CombatSystem";
import { validateGameConfig } from "../config/ConfigValidator";
import {
  UPGRADE_DEFINITIONS,
  BUILDING_UPGRADE_DEFINITIONS,
  BARACK_UPGRADE_DEFINITIONS,
  applyUpgradesToStats,
  getBuildingUpgradeMultipliers,
  getBarrackUpgradeMultipliers,
} from "../upgrades/definitions";
import { runAutoDevelopment } from "../ai/AutoDevelopment";
import type { WarriorStats } from "../entities/units/WarriorTypes";
import { NeutralPoint, type NeutralPointSnapshot } from "../entities/NeutralPoint";

export interface PlayerState {
  gold: number;
  upgradeIds: string[];
  buildingUpgradeIds: string[];
}

export interface AttackEffect {
  from: { x: number; y: number };
  to: { x: number; y: number };
  timeMs: number;
}

export interface BarrackBuyCapacity {
  current: number;
  max: number;
}

export interface GameStateSnapshot {
  timeMs: number;
  entities: readonly Entity[];
  neutralPoints: readonly NeutralPointSnapshot[];
  gameOver: boolean;
  winnerIds: string[];
  playerStates: Record<string, PlayerState>;
  barrackUpgrades: Record<string, string[]>;
  barrackBuyCapacity: Record<string, BarrackBuyCapacity>;
  barrackRepairCooldownMs: Record<string, number>;
  attackEffects: readonly AttackEffect[];
}

type Subscriber = (state: GameStateSnapshot) => void;

/**
 * Центральная модель игры: сущности, время, системы.
 * Не знает о React/Canvas — только чистая игровая логика.
 */
export class Game {
  public readonly config: GameConfig;

  private timeMs = 0;
  private gameOver = false;
  private winnerIds: string[] = [];
  private readonly entities = new Map<EntityId, Entity>();
  private readonly warriors = new Map<EntityId, Warrior>();
  private readonly barracks = new Map<EntityId, Barrack>();
  private readonly playerStates = new Map<string, PlayerState>();
  private readonly barrackUpgrades = new Map<EntityId, string[]>();
  private readonly neutralPoints = new Map<string, NeutralPoint>();

  private readonly movementSystem = new MovementSystem();
  private readonly combatSystem = new CombatSystem();
  private readonly attackEffects: AttackEffect[] = [];
  private static readonly ATTACK_EFFECT_DURATION_MS = 180;
  private static readonly GOLD_PER_WARRIOR_KILL = 5;
  static readonly BUY_WARRIOR_COST = 30;
  private spawningEnabled = false;

  private static readonly GOLD_PER_SECOND_CASTLE = 3;
  private static readonly GOLD_PER_SECOND_BUILDING = 1;
  private readonly subscribers = new Set<Subscriber>();

  private autoDevelopmentEnabled = true;
  private lastAutoDevTimeMs = 0;

  constructor(config: GameConfig) {
    validateGameConfig(config);
    this.config = config;
    this.bootstrapFromConfig(config);
  }

  /**
   * Инициализация сущностей из конфигурации.
   */
  private bootstrapFromConfig(config: GameConfig): void {
    for (const player of config.players) {
      this.playerStates.set(player.id, { gold: 0, upgradeIds: [], buildingUpgradeIds: [] });

      const castle = new Castle({
        id: player.castle.id,
        ownerId: player.id,
        position: player.castle.position,
        maxHp: player.castle.maxHp,
        radius: player.castle.radius,
        attackRange: player.castle.attackRange,
        attackDamage: player.castle.attackDamage,
        attackIntervalMs: player.castle.attackIntervalMs,
      });
      this.addEntity(castle);

      for (const barrackConfig of player.barracks) {
        const warriorStats = config.warriorTypes[barrackConfig.warriorTypeId];

        if (!warriorStats) {
          throw new Error(
            `GameConfig: warriorTypeId "${barrackConfig.warriorTypeId}" не определён.`,
          );
        }

        const barrack = new Barrack({
          id: barrackConfig.id,
          ownerId: player.id,
          position: barrackConfig.position,
          maxHp: barrackConfig.maxHp,
          radius: barrackConfig.radius,
          spawnIntervalMs: barrackConfig.spawnIntervalMs,
          warriorTypeId: barrackConfig.warriorTypeId,
          warriorStats,
          resolveStats: (ownerId, base) => this.getEffectiveWarriorStats(ownerId, base),
          onSpawnWarrior: (warrior) => this.registerWarrior(warrior),
          canSpawn: () => this.spawningEnabled && this.playerHasAnyBuilding(player.id),
        });

        if (barrackConfig.defaultRoute && barrackConfig.defaultRoute.length > 0) {
          barrack.setRouteFromConfig(barrackConfig.defaultRoute);
        }

        this.addEntity(barrack);
        this.barracks.set(barrack.id, barrack);
        this.barrackUpgrades.set(barrack.id, []);
      }

      for (const towerConfig of player.towers) {
        const tower = new Tower({
          id: towerConfig.id,
          ownerId: player.id,
          position: towerConfig.position,
          maxHp: towerConfig.maxHp,
          radius: towerConfig.radius,
          attackRange: towerConfig.attackRange,
          attackDamage: towerConfig.attackDamage,
        });
        this.addEntity(tower);
      }
    }

    for (const ptConfig of config.neutralPoints ?? []) {
      const pt = new NeutralPoint(ptConfig);
      this.neutralPoints.set(pt.id, pt);
    }
  }

  private addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    if (entity instanceof Warrior) {
      this.warriors.set(entity.id, entity);
    }
  }

  private registerWarrior(warrior: Warrior): void {
    this.addEntity(warrior);
  }

  /** Проверяет, есть ли у игрока хотя бы одно живое здание (замок, барак, башня). */
  private playerHasAnyBuilding(playerId: string): boolean {
    for (const entity of this.entities.values()) {
      if (
        entity.ownerId === playerId &&
        entity.isAlive &&
        (entity.kind === "castle" || entity.kind === "barrack" || entity.kind === "tower")
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Шаг симуляции (фиксированная дельта, вызывается из GameLoop).
   */
  update(deltaTimeMs: number): void {
    this.timeMs += deltaTimeMs;

    // Накопление золота — только в режиме теста.
    if (this.spawningEnabled) {
      for (const [playerId, ps] of this.playerStates) {
        let income = 0;
        for (const entity of this.entities.values()) {
          if (entity.ownerId !== playerId || !entity.isAlive) continue;
          if (entity.kind === "castle") income += Game.GOLD_PER_SECOND_CASTLE;
          else if (entity.kind === "barrack" || entity.kind === "tower")
            income += Game.GOLD_PER_SECOND_BUILDING;
        }
        ps.gold += (income * deltaTimeMs) / 1000;
      }
    }

    // Обновление сущностей (спавн в бараках и т.п.).
    for (const entity of this.entities.values()) {
      entity.update(deltaTimeMs);
    }

    const onWarriorKilled = this.spawningEnabled
      ? (killerOwnerId: string) => {
          const ps = this.playerStates.get(killerOwnerId);
          if (ps) ps.gold += Game.GOLD_PER_WARRIOR_KILL;
        }
      : undefined;

    // Система движения и атаки воинов.
    this.movementSystem.update(this.warriors.values(), this.entities, deltaTimeMs, onWarriorKilled);

    // Захват нейтральных точек: воин в радиусе = последний владелец
    if (this.spawningEnabled) {
      for (const warrior of this.warriors.values()) {
        if (!warrior.isAlive) continue;
        for (const pt of this.neutralPoints.values()) {
          pt.tryCapture(warrior.position, warrior.ownerId);
        }
      }
      for (const pt of this.neutralPoints.values()) {
        const result = pt.update(deltaTimeMs);
        if (result) {
          const ps = this.playerStates.get(result.playerId);
          if (ps) ps.gold += result.gold;
        }
      }
    }

    // Атака зданий (замок, башни) по вражеским воинам.
    this.combatSystem.update(
      this.entities,
      this.warriors.values(),
      deltaTimeMs,
      (from, to) => {
        this.attackEffects.push({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, timeMs: this.timeMs });
      },
      onWarriorKilled,
    );

    // Удаляем мёртвые сущности. Бараки не удаляем — они продолжают спавнить в 2 раза медленнее.
    for (const [id, entity] of this.entities) {
      if (!entity.isAlive && entity.kind !== "barrack") {
        this.entities.delete(id);
        this.warriors.delete(id);
        this.barracks.delete(id);
        this.barrackUpgrades.delete(id);
      }
    }

    if (!this.gameOver) {
      const playersWithBuildings = new Set<string>();
      for (const entity of this.entities.values()) {
        if (
          entity.isAlive &&
          (entity.kind === "castle" || entity.kind === "barrack" || entity.kind === "tower")
        ) {
          playersWithBuildings.add(entity.ownerId);
        }
      }
      if (playersWithBuildings.size <= 1) {
        this.gameOver = true;
        this.winnerIds = Array.from(playersWithBuildings);
      }
    }

    // Авторазвитие: периодически покупает улучшения для всех игроков
    if (this.spawningEnabled) {
      const snapshot = this.getStateSnapshot();
      this.lastAutoDevTimeMs = runAutoDevelopment(
        this,
        snapshot,
        this.autoDevelopmentEnabled,
        this.lastAutoDevTimeMs,
        this.timeMs,
      );
    }

    this.emitState();
  }

  getStateSnapshot(): GameStateSnapshot {
    const playerStates: Record<string, PlayerState> = {};
    for (const [id, ps] of this.playerStates) {
      playerStates[id] = {
        gold: ps.gold,
        upgradeIds: [...(ps.upgradeIds ?? [])],
        buildingUpgradeIds: [...(ps.buildingUpgradeIds ?? [])],
      };
    }
    const barrackUpgrades: Record<string, string[]> = {};
    for (const [id, ids] of this.barrackUpgrades) {
      barrackUpgrades[id] = [...ids];
    }
    const barrackBuyCapacity: Record<string, BarrackBuyCapacity> = {};
    const barrackRepairCooldownMs: Record<string, number> = {};
    for (const [id, barrack] of this.barracks) {
      if (barrack.isAlive) {
        barrackBuyCapacity[id] = barrack.getBuyCapacity();
        barrackRepairCooldownMs[id] = barrack.getRepairCooldownMs();
      }
    }
    // Оставляем только недавние эффекты атаки.
    const cutoff = this.timeMs - Game.ATTACK_EFFECT_DURATION_MS;
    const recentEffects = this.attackEffects.filter((e) => e.timeMs > cutoff);
    this.attackEffects.length = 0;
    this.attackEffects.push(...recentEffects);

    return {
      timeMs: this.timeMs,
      entities: Array.from(this.entities.values()),
      neutralPoints: Array.from(this.neutralPoints.values()).map((pt) => pt.toSnapshot()),
      gameOver: this.gameOver,
      winnerIds: this.winnerIds,
      playerStates,
      barrackUpgrades,
      barrackBuyCapacity,
      barrackRepairCooldownMs,
      attackEffects: [...this.attackEffects],
    };
  }

  getEffectiveWarriorStats(playerId: string, baseStats: WarriorStats): WarriorStats {
    const ps = this.playerStates.get(playerId);
    if (!ps) return baseStats;
    return applyUpgradesToStats(baseStats, ps.upgradeIds);
  }

  buyUpgrade(playerId: string, upgradeId: string): boolean {
    const ps = this.playerStates.get(playerId);
    if (!ps) return false;

    const warriorDef = UPGRADE_DEFINITIONS.find((d) => d.id === upgradeId);
    const buildingDef = BUILDING_UPGRADE_DEFINITIONS.find((d) => d.id === upgradeId);

    if (warriorDef) {
      if (ps.upgradeIds.includes(upgradeId)) return false;
      if (warriorDef.prerequisiteId && !ps.upgradeIds.includes(warriorDef.prerequisiteId))
        return false;
      if (ps.gold < warriorDef.cost) return false;
      ps.gold -= warriorDef.cost;
      ps.upgradeIds.push(upgradeId);
      this.applyUpgradesToExistingWarriors(playerId);
      return true;
    }

    if (buildingDef) {
      if (ps.buildingUpgradeIds.includes(upgradeId)) return false;
      if (buildingDef.prerequisiteId && !ps.buildingUpgradeIds.includes(buildingDef.prerequisiteId))
        return false;
      if (ps.gold < buildingDef.cost) return false;
      ps.gold -= buildingDef.cost;
      ps.buildingUpgradeIds.push(upgradeId);
      this.applyBuildingUpgradesToExisting(playerId);
      return true;
    }

    return false;
  }

  buyBarrackUpgrade(playerId: string, barrackId: string, upgradeId: string): boolean {
    const barrack = this.barracks.get(barrackId);
    const ps = this.playerStates.get(playerId);
    if (!barrack || !ps || barrack.ownerId !== playerId) return false;

    const def = BARACK_UPGRADE_DEFINITIONS.find((d) => d.id === upgradeId);
    if (!def) return false;

    const ids = this.barrackUpgrades.get(barrackId) ?? [];
    if (ids.includes(upgradeId)) return false;
    if (def.prerequisiteId && !ids.includes(def.prerequisiteId)) return false;
    if (ps.gold < def.cost) return false;

    ps.gold -= def.cost;
    this.barrackUpgrades.set(barrackId, [...ids, upgradeId]);
    this.applyBarrackUpgrades(barrackId);
    return true;
  }

  /**
   * Докупить воина в бараке за золото.
   * Лимит зависит от прокачки барака (spawnCount), восстанавливается по таймауту.
   */
  buyBarrackWarrior(playerId: string, barrackId: string): boolean {
    const barrack = this.barracks.get(barrackId);
    const ps = this.playerStates.get(playerId);
    if (!barrack || !ps || barrack.ownerId !== playerId || !barrack.isAlive) return false;
    if (ps.gold < Game.BUY_WARRIOR_COST) return false;
    if (!barrack.consumeBuyCapacity()) return false;

    ps.gold -= Game.BUY_WARRIOR_COST;
    barrack.spawnBuyWarrior();
    return true;
  }

  /** Ремонт барака на 20% HP. Бесплатно, откат 2 мин. */
  repairBarrack(playerId: string, barrackId: string): boolean {
    const barrack = this.barracks.get(barrackId);
    if (!barrack || barrack.ownerId !== playerId || !barrack.isAlive) return false;
    return barrack.repair();
  }

  private applyBuildingUpgradesToExisting(playerId: string): void {
    const ps = this.playerStates.get(playerId);
    if (!ps) return;
    const globalMult = getBuildingUpgradeMultipliers(ps.buildingUpgradeIds);

    for (const entity of this.entities.values()) {
      if (entity.ownerId !== playerId || !entity.isAlive) continue;
      if (entity.kind === "castle") {
        (entity as Castle).applyUpgrades(globalMult.buildingHp, globalMult.castleDamage);
      } else if (entity.kind === "tower") {
        (entity as Tower).applyUpgrades(globalMult.buildingHp, globalMult.towerDamage);
      } else if (entity.kind === "barrack") {
        const barrackIds = this.barrackUpgrades.get(entity.id) ?? [];
        const barrackMult = getBarrackUpgradeMultipliers(barrackIds);
        (entity as Barrack).applyUpgrades(
          globalMult.buildingHp,
          barrackMult.barrackHp,
          barrackMult.spawnSpeed,
          barrackMult.spawnCount,
        );
      }
    }
  }

  private applyBarrackUpgrades(barrackId: string): void {
    const barrack = this.barracks.get(barrackId);
    if (!barrack || !barrack.isAlive) return;
    const ps = this.playerStates.get(barrack.ownerId);
    if (!ps) return;

    const globalMult = getBuildingUpgradeMultipliers(ps.buildingUpgradeIds);
    const barrackIds = this.barrackUpgrades.get(barrackId) ?? [];
    const barrackMult = getBarrackUpgradeMultipliers(barrackIds);

    barrack.applyUpgrades(
      globalMult.buildingHp,
      barrackMult.barrackHp,
      barrackMult.spawnSpeed,
      barrackMult.spawnCount,
    );
  }

  private applyUpgradesToExistingWarriors(playerId: string): void {
    const baseTypes = this.config.warriorTypes;
    for (const warrior of this.warriors.values()) {
      if (warrior.ownerId !== playerId || !warrior.isAlive) continue;
      const baseStats = baseTypes[warrior.baseWarriorTypeId];
      if (!baseStats) continue;
      const newStats = this.getEffectiveWarriorStats(playerId, baseStats);
      warrior.applyUpgradedStats(newStats);
    }
  }

  /**
   * Подписка на снимки состояния (для React/Canvas).
   */
  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getStateSnapshot());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private emitState(): void {
    const snapshot = this.getStateSnapshot();
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  setSpawningEnabled(enabled: boolean): void {
    this.spawningEnabled = enabled;
  }

  setAutoDevelopmentEnabled(enabled: boolean): void {
    this.autoDevelopmentEnabled = enabled;
  }

  isAutoDevelopmentEnabled(): boolean {
    return this.autoDevelopmentEnabled;
  }

  /**
   * Публичный API для UI: задать маршрут бараку.
   */
  setBarrackRoute(
    barrackId: string,
    waypoints: { x: number; y: number }[],
  ): void {
    const barrack = this.barracks.get(barrackId);
    if (!barrack) return;

    barrack.setRouteFromConfig(waypoints);
  }

  /**
   * Переместить здание (замок, барак, башня) в новую позицию.
   * Используется редактором расстановки зданий.
   */
  setBuildingPosition(
    entityId: string,
    position: { x: number; y: number },
  ): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    if (entity.kind !== "castle" && entity.kind !== "barrack" && entity.kind !== "tower") {
      return;
    }
    entity.position.x = position.x;
    entity.position.y = position.y;
  }

  /**
   * Добавить новый барак для игрока по указанной позиции.
   */
  addBarrack(
    playerId: string,
    position: { x: number; y: number },
    options?: { id?: string; warriorTypeId?: string; spawnIntervalMs?: number },
  ): string | null {
    const player = this.config.players.find((p) => p.id === playerId);
    if (!player) return null;

    const warriorTypeId = options?.warriorTypeId ?? "basic";
    const warriorStats = this.config.warriorTypes[warriorTypeId];
    if (!warriorStats) return null;

    const id =
      options?.id ?? `barrack-${playerId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    if (this.entities.has(id)) return null;

    const barrack = new Barrack({
      id,
      ownerId: playerId,
      position: { ...position },
      maxHp: 200,
      radius: 15,
      spawnIntervalMs: options?.spawnIntervalMs ?? 2000,
      warriorTypeId,
      warriorStats,
      resolveStats: (ownerId, base) => this.getEffectiveWarriorStats(ownerId, base),
      onSpawnWarrior: (warrior) => this.registerWarrior(warrior),
      canSpawn: () => this.spawningEnabled && this.playerHasAnyBuilding(playerId),
    });

    this.addEntity(barrack);
    this.barracks.set(barrack.id, barrack);
    this.barrackUpgrades.set(barrack.id, []);
    this.applyBuildingUpgradesToExisting(playerId);
    return barrack.id;
  }

  /**
   * Добавить новую башню для игрока по указанной позиции.
   */
  addTower(
    playerId: string,
    position: { x: number; y: number },
    options?: { id?: string; attackRange?: number; attackDamage?: number },
  ): string | null {
    const player = this.config.players.find((p) => p.id === playerId);
    if (!player) return null;

    const id =
      options?.id ?? `tower-${playerId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    if (this.entities.has(id)) return null;

    const tower = new Tower({
      id,
      ownerId: playerId,
      position: { ...position },
      maxHp: 200,
      radius: 8,
      attackRange: options?.attackRange ?? 80,
      attackDamage: options?.attackDamage ?? 15,
    });

    this.addEntity(tower);
    this.applyBuildingUpgradesToExisting(playerId);
    return tower.id;
  }

  /**
   * Добавить нейтральную точку захвата (для редактора).
   */
  addNeutralPoint(
    position: { x: number; y: number },
    options?: { id?: string; radius?: number; captureRadius?: number; goldPerInterval?: number; goldIntervalMs?: number },
  ): string | null {
    const id =
      options?.id ?? `neutral-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (this.neutralPoints.has(id)) return null;

    const pt = new NeutralPoint({
      id,
      position: { ...position },
      radius: options?.radius ?? 12,
      captureRadius: options?.captureRadius ?? 80,
      goldPerInterval: options?.goldPerInterval ?? 2,
      goldIntervalMs: options?.goldIntervalMs ?? 5000,
    });
    this.neutralPoints.set(id, pt);
    return id;
  }

  /** Удалить нейтральную точку (для редактора). */
  removeNeutralPoint(id: string): boolean {
    return this.neutralPoints.delete(id);
  }
}
