import { GameConfig, type NeutralPointConfig } from "../config/defaultConfig";
import { Entity, EntityId } from "../entities/Entity";
import { Barrack } from "../entities/base/Barrack";
import {
  Castle,
  CASTLE_SPELL,
  CASTLE_SPELL_1,
  CASTLE_SPELL_2,
  CASTLE_EXPLOSION_RADIUS,
} from "../entities/base/Castle";
import { Tower } from "../entities/base/Tower";
import { Warrior } from "../entities/units/Warrior";
import { Hero } from "../entities/units/Hero";
import { MovementSystem, type HeroUnderAttack } from "../pathfinding/MovementSystem";
import { CombatSystem } from "../combat/CombatSystem";
import { validateGameConfig } from "../config/ConfigValidator";
import {
  BARACK_UPGRADE_DEFINITIONS,
  applyUpgradesToStatsFromLevels,
  getBuildingUpgradeMultipliersFromLevels,
  getBarrackUpgradeMultipliers,
  getCastleUpgradeCost,
  getTrackUpgradeCost,
  getMaxTrackLevel,
  getMaxMagicLevel,
  getCastleLevelMultipliers,
} from "../upgrades/definitions";
import { runAutoDevelopment } from "../ai/AutoDevelopment";
import type { WarriorStats } from "../entities/units/WarriorTypes";
import { NeutralPoint, type NeutralPointSnapshot } from "../entities/NeutralPoint";

/** Треки улучшений замка (уровневая система). */
export type CastleUpgradeTrack =
  | "castle"
  | "ranged"
  | "melee"
  | "buildingHp"
  | "unitHp"
  | "unitDefense"
  | "magic";

export interface PlayerState {
  gold: number;
  castleLevel: number;
  rangedLevel: number;
  meleeLevel: number;
  buildingHpLevel: number;
  unitHpLevel: number;
  unitDefenseLevel: number;
  magicLevel: number;
}

export interface AttackEffect {
  from: { x: number; y: number };
  to: { x: number; y: number };
  timeMs: number;
}

export interface SpellEffect {
  position: { x: number; y: number };
  radius: number;
  /** Для прямоугольных заклинаний (Spell 1). */
  rectWidth?: number;
  rectHeight?: number;
  ownerId: string;
  timeMs: number;
}

export interface BarrackBuyCapacity {
  current: number;
  max: number;
}

/** Сериализуемый снимок сущности для передачи по сети и рендера. */
export interface EntitySnapshot {
  id: string;
  ownerId: string;
  kind: string;
  position: { x: number; y: number };
  radius: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  /** Для воинов — базовый тип (basic, archer и т.д.) для визуального отличия. */
  baseWarriorTypeId?: string;
  /** Для замка — мана и кулдауны заклинаний. */
  mana?: number;
  maxMana?: number;
  spell1CooldownMs?: number;
  spell2CooldownMs?: number;
  /** Для героя — тип, уровень, золото за убийство. */
  isHero?: boolean;
  heroTypeId?: string;
  level?: number;
  goldBounty?: number;
}

export interface GameStateSnapshot {
  timeMs: number;
  entities: readonly EntitySnapshot[];
  neutralPoints: readonly NeutralPointSnapshot[];
  gameOver: boolean;
  winnerIds: string[];
  playerStates: Record<string, PlayerState>;
  barrackUpgrades: Record<string, string[]>;
  barrackBuyCapacity: Record<string, BarrackBuyCapacity>;
  barrackRepairCooldownMs: Record<string, number>;
  /** Кулдауны вызова героев: barrackId -> heroTypeId -> оставшиеся мс. */
  barrackHeroCooldowns: Record<string, Record<string, number>>;
  attackEffects: readonly AttackEffect[];
  spellEffects: readonly SpellEffect[];
}

/** Сериализуемая версия снимка (JSON-совместима). */
export type GameStateSnapshotSerialized = GameStateSnapshot;

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
  private readonly spellEffects: SpellEffect[] = [];
  private static readonly ATTACK_EFFECT_DURATION_MS = 180;
  private static readonly SPELL_EFFECT_DURATION_MS = 800;
  private static readonly GOLD_PER_WARRIOR_KILL = 5;
  private static readonly GOLD_PER_HERO_KILL = 25;
  static readonly BUY_WARRIOR_COST = 30;
  static readonly HERO_SUMMON_COST = 100;
  private static readonly HERO_RESPAWN_COOLDOWN_MS = 180000; // 3 минуты
  private static readonly HERO_UNDER_ATTACK_DURATION_MS = 2000;
  private spawningEnabled = false;

  /** Атакуют нашего героя — юниты переагриваются на атакующего. Очищается по таймауту. */
  private heroUnderAttackRef = { current: null as HeroUnderAttack | null };

  /** Кулдауны героев по баракам: barrackId -> Map<heroTypeId, cooldownMs>. */
  private readonly barrackHeroCooldowns = new Map<string, Map<string, number>>();
  /** Сохранённый прогресс героев после смерти: "playerId-heroTypeId" -> { level, xp }. */
  private readonly heroProgress = new Map<string, { level: number; xp: number }>();

  private static readonly GOLD_PER_SECOND_CASTLE = 3;
  private static readonly GOLD_PER_SECOND_BUILDING = 1;
  private readonly subscribers = new Set<Subscriber>();

  private autoDevelopmentEnabled = true;
  private lastAutoDevTimeMs = 0;
  private humanPlayerIds = new Set<string>();

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
      this.playerStates.set(player.id, {
        gold: 0,
        castleLevel: 0,
        rangedLevel: 0,
        meleeLevel: 0,
        buildingHpLevel: 0,
        unitHpLevel: 0,
        unitDefenseLevel: 0,
        magicLevel: 0,
      });

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
        const warriorTypeIds =
          barrackConfig.warriorTypeIds ??
          (barrackConfig.warriorTypeId ? [barrackConfig.warriorTypeId] : ["basic"]);

        for (const tid of warriorTypeIds) {
          if (!config.warriorTypes[tid]) {
            throw new Error(`GameConfig: warriorTypeId "${tid}" не определён.`);
          }
        }

        const barrack = new Barrack({
          id: barrackConfig.id,
          ownerId: player.id,
          position: barrackConfig.position,
          maxHp: barrackConfig.maxHp,
          radius: barrackConfig.radius,
          spawnIntervalMs: barrackConfig.spawnIntervalMs,
          warriorTypeIds,
          resolveStatsForType: (ownerId, typeId) =>
            this.getEffectiveWarriorStats(ownerId, config.warriorTypes[typeId]),
          onSpawnWarrior: (warrior) => this.registerWarrior(warrior),
          canSpawn: () => this.spawningEnabled && this.playerHasAnyBuilding(player.id),
          attackRange: barrackConfig.attackRange ?? 0,
          attackDamage: barrackConfig.attackDamage ?? 0,
          attackIntervalMs: barrackConfig.attackIntervalMs ?? 600,
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
          attackIntervalMs: towerConfig.attackIntervalMs,
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

  private setHeroCooldown(barrackId: string, heroTypeId: string): void {
    let map = this.barrackHeroCooldowns.get(barrackId);
    if (!map) {
      map = new Map();
      this.barrackHeroCooldowns.set(barrackId, map);
    }
    map.set(heroTypeId, Game.HERO_RESPAWN_COOLDOWN_MS);
  }

  private getHeroCooldown(barrackId: string, heroTypeId: string): number {
    return this.barrackHeroCooldowns.get(barrackId)?.get(heroTypeId) ?? 0;
  }

  /** Есть ли живой герой данного типа у игрока. */
  private isHeroTypeAlive(playerId: string, heroTypeId: string): boolean {
    for (const warrior of this.warriors.values()) {
      if (warrior.isHero && warrior instanceof Hero && warrior.ownerId === playerId && warrior.heroTypeId === heroTypeId && warrior.isAlive) {
        return true;
      }
    }
    return false;
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

    // Обновление кулдаунов героев по баракам.
    for (const barrackMap of this.barrackHeroCooldowns.values()) {
      for (const [heroTypeId, remaining] of barrackMap) {
        const newRemaining = Math.max(0, remaining - deltaTimeMs);
        barrackMap.set(heroTypeId, newRemaining);
      }
    }

    const onWarriorKilled = this.spawningEnabled
      ? (killerOwnerId: string, victim?: Entity) => {
          const ps = this.playerStates.get(killerOwnerId);
          if (!ps) return;
          if (victim instanceof Hero) {
            ps.gold += victim.goldBounty;
            this.heroProgress.set(`${victim.ownerId}-${victim.heroTypeId}`, {
              level: victim.level,
              xp: victim.xp,
            });
            this.setHeroCooldown(victim.sourceBarrackId, victim.heroTypeId);
          } else {
            ps.gold += Game.GOLD_PER_WARRIOR_KILL;
          }
        }
      : undefined;

    const XP_PER_WARRIOR_KILL = 10;
    const XP_PER_HERO_KILL = 50;
    const onHeroKill = this.spawningEnabled
      ? (hero: Hero, victim: Entity) => {
          if (victim instanceof Hero) {
            hero.gainXp(XP_PER_HERO_KILL);
          } else {
            hero.gainXp(XP_PER_WARRIOR_KILL);
          }
        }
      : undefined;

    // Сброс heroUnderAttack по таймауту или если атакующий мёртв
    const ref = this.heroUnderAttackRef.current;
    if (ref) {
      if (!ref.attacker.isAlive || this.timeMs - ref.timeMs > Game.HERO_UNDER_ATTACK_DURATION_MS) {
        this.heroUnderAttackRef.current = null;
      }
    }

    // Система движения и атаки воинов.
    this.movementSystem.update(
      this.warriors.values(),
      this.entities,
      deltaTimeMs,
      onWarriorKilled,
      (from, to) => {
        this.attackEffects.push({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, timeMs: this.timeMs });
      },
      onHeroKill,
      this.heroUnderAttackRef,
      this.timeMs,
    );

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
      (killerId, victim) => onWarriorKilled?.(killerId, victim),
    );

    // Удаляем мёртвые сущности. При разрушении замка — взрыв, убивающий всех в области базы.
    for (const [id, entity] of this.entities) {
      if (!entity.isAlive && entity.kind === "castle") {
        const cx = entity.position.x;
        const cy = entity.position.y;
        const r2 = CASTLE_EXPLOSION_RADIUS * CASTLE_EXPLOSION_RADIUS;
        this.spellEffects.push({
          position: { x: cx, y: cy },
          radius: CASTLE_EXPLOSION_RADIUS,
          ownerId: entity.ownerId,
          timeMs: this.timeMs,
        });
        const castleOwnerId = entity.ownerId;
        for (const warrior of this.warriors.values()) {
          if (!warrior.isAlive || warrior.ownerId === castleOwnerId) continue;
          const dx = warrior.position.x - cx;
          const dy = warrior.position.y - cy;
          if (dx * dx + dy * dy <= r2) {
            if (warrior instanceof Hero && this.spawningEnabled) {
              this.heroProgress.set(`${warrior.ownerId}-${warrior.heroTypeId}`, {
                level: warrior.level,
                xp: warrior.xp,
              });
              this.setHeroCooldown(warrior.sourceBarrackId, warrior.heroTypeId);
            }
            warrior.takeDamage(warrior.maxHp);
          }
        }
        this.entities.delete(id);
        continue;
      }
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

    // Авторазвитие: периодически покупает улучшения для AI-игроков (не humanPlayerIds)
    if (this.spawningEnabled) {
      const snapshot = this.getStateSnapshot();
      this.lastAutoDevTimeMs = runAutoDevelopment(
        this,
        snapshot,
        this.autoDevelopmentEnabled,
        this.lastAutoDevTimeMs,
        this.timeMs,
        this.humanPlayerIds,
      );
    }

    this.emitState();
  }

  getStateSnapshot(): GameStateSnapshot {
    const playerStates: Record<string, PlayerState> = {};
    for (const [id, ps] of this.playerStates) {
      playerStates[id] = { ...ps };
    }
    const barrackUpgrades: Record<string, string[]> = {};
    for (const [id, ids] of this.barrackUpgrades) {
      barrackUpgrades[id] = [...ids];
    }
    const barrackBuyCapacity: Record<string, BarrackBuyCapacity> = {};
    const barrackRepairCooldownMs: Record<string, number> = {};
    const barrackHeroCooldowns: Record<string, Record<string, number>> = {};
    for (const [id, barrack] of this.barracks) {
      if (barrack.isAlive) {
        barrackBuyCapacity[id] = barrack.getBuyCapacity();
        barrackRepairCooldownMs[id] = barrack.getRepairCooldownMs();
      }
    }
    for (const [barrackId, heroMap] of this.barrackHeroCooldowns) {
      const entries: Record<string, number> = {};
      for (const [heroTypeId, cooldownMs] of heroMap) {
        if (cooldownMs > 0) entries[heroTypeId] = cooldownMs;
      }
      if (Object.keys(entries).length > 0) {
        barrackHeroCooldowns[barrackId] = entries;
      }
    }
    // Оставляем только недавние эффекты атаки и заклинаний.
    const cutoff = this.timeMs - Game.ATTACK_EFFECT_DURATION_MS;
    const recentEffects = this.attackEffects.filter((e) => e.timeMs > cutoff);
    this.attackEffects.length = 0;
    this.attackEffects.push(...recentEffects);
    const spellCutoff = this.timeMs - Game.SPELL_EFFECT_DURATION_MS;
    const recentSpells = this.spellEffects.filter((e) => e.timeMs > spellCutoff);
    this.spellEffects.length = 0;
    this.spellEffects.push(...recentSpells);

    const entities: EntitySnapshot[] = Array.from(this.entities.values()).map((e) => {
      const base: EntitySnapshot = {
        id: e.id,
        ownerId: e.ownerId,
        kind: e.kind,
        position: { x: e.position.x, y: e.position.y },
        radius: e.radius,
        hp: e.hp,
        maxHp: e.maxHp,
        isAlive: e.isAlive,
      };
      if (e instanceof Warrior) {
        base.baseWarriorTypeId = e.baseWarriorTypeId;
      }
      if (e instanceof Hero) {
        base.isHero = true;
        base.heroTypeId = e.heroTypeId;
        base.level = e.level;
        base.goldBounty = e.goldBounty;
      }
      if (e instanceof Castle) {
        base.mana = e.mana;
        base.maxMana = CASTLE_SPELL.MANA_MAX;
        base.spell1CooldownMs = e.spell1CooldownMs;
        base.spell2CooldownMs = e.spell2CooldownMs;
      }
      return base;
    });

    return {
      timeMs: this.timeMs,
      entities,
      neutralPoints: Array.from(this.neutralPoints.values()).map((pt) => pt.toSnapshot()),
      gameOver: this.gameOver,
      winnerIds: this.winnerIds,
      playerStates,
      barrackUpgrades,
      barrackBuyCapacity,
      barrackRepairCooldownMs,
      barrackHeroCooldowns,
      attackEffects: [...this.attackEffects],
      spellEffects: [...this.spellEffects],
    };
  }

  getEffectiveWarriorStats(playerId: string, baseStats: WarriorStats): WarriorStats {
    const ps = this.playerStates.get(playerId);
    if (!ps) return baseStats;
    return applyUpgradesToStatsFromLevels(baseStats, ps);
  }

  buyCastleUpgrade(playerId: string, trackId: CastleUpgradeTrack): boolean {
    const ps = this.playerStates.get(playerId);
    if (!ps) return false;

    if (trackId === "castle") {
      const cost = getCastleUpgradeCost(ps.castleLevel);
      if (cost == null || ps.gold < cost) return false;
      if (ps.castleLevel >= 3) return false;
      ps.gold -= cost;
      ps.castleLevel += 1;
      this.applyBuildingUpgradesToExisting(playerId);
      return true;
    }

    const maxTrack = getMaxTrackLevel(ps.castleLevel);
    const maxMagic = getMaxMagicLevel(ps.castleLevel);

    const level =
      trackId === "ranged"
        ? ps.rangedLevel
        : trackId === "melee"
          ? ps.meleeLevel
          : trackId === "buildingHp"
            ? ps.buildingHpLevel
            : trackId === "unitHp"
              ? ps.unitHpLevel
              : trackId === "unitDefense"
                ? ps.unitDefenseLevel
                : ps.magicLevel;
    const maxLevel = trackId === "magic" ? maxMagic : maxTrack;
    if (level >= maxLevel) return false;

    const cost = getTrackUpgradeCost(level);
    if (ps.gold < cost) return false;

    ps.gold -= cost;
    switch (trackId) {
      case "ranged":
        ps.rangedLevel = level + 1;
        break;
      case "melee":
        ps.meleeLevel = level + 1;
        break;
      case "buildingHp":
        ps.buildingHpLevel = level + 1;
        break;
      case "unitHp":
        ps.unitHpLevel = level + 1;
        break;
      case "unitDefense":
        ps.unitDefenseLevel = level + 1;
        break;
      case "magic":
        ps.magicLevel = level + 1;
        break;
    }

    if (trackId === "unitHp" || trackId === "unitDefense" || trackId === "ranged" || trackId === "melee") {
      this.applyUpgradesToExistingWarriors(playerId);
    } else {
      this.applyBuildingUpgradesToExisting(playerId);
    }
    return true;
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

  /** Проверка возможности вызова героя (для ИИ — использует актуальное состояние, не snapshot). */
  canSummonHero(playerId: string, barrackId: string, heroTypeId: string): boolean {
    const barrack = this.barracks.get(barrackId);
    const ps = this.playerStates.get(playerId);
    if (!barrack || !ps || barrack.ownerId !== playerId || !barrack.isAlive) return false;
    const heroTypes = this.config.heroTypes ?? {};
    if (!heroTypes[heroTypeId]) return false;
    if (ps.gold < Game.HERO_SUMMON_COST) return false;
    if (this.isHeroTypeAlive(playerId, heroTypeId)) return false;
    if (this.getHeroCooldown(barrackId, heroTypeId) > 0) return false;
    return true;
  }

  /**
   * Вызвать героя из барака.
   * Герой типа X может быть только один в живых. При смерти — долгий кулдаун в бараке-источнике.
   */
  summonHero(playerId: string, barrackId: string, heroTypeId: string): boolean {
    const barrack = this.barracks.get(barrackId);
    const ps = this.playerStates.get(playerId);
    if (!barrack || !ps || barrack.ownerId !== playerId || !barrack.isAlive) return false;

    const heroTypes = this.config.heroTypes ?? {};
    const baseStats = heroTypes[heroTypeId];
    if (!baseStats) return false;

    if (ps.gold < Game.HERO_SUMMON_COST) return false;
    if (this.isHeroTypeAlive(playerId, heroTypeId)) return false;
    if (this.getHeroCooldown(barrackId, heroTypeId) > 0) return false;

    ps.gold -= Game.HERO_SUMMON_COST;

    const savedProgress = this.heroProgress.get(`${playerId}-${heroTypeId}`);
    const position = { x: barrack.position.x, y: barrack.position.y };
    const hero = new Hero({
      id: `${barrackId}-hero-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ownerId: playerId,
      position,
      radius: 9,
      stats: { ...baseStats },
      heroTypeId,
      sourceBarrackId: barrackId,
      routeManager: barrack.routeManager,
      initialLevel: savedProgress?.level,
      initialXp: savedProgress?.xp,
    });

    this.registerWarrior(hero);
    return true;
  }

  /** Ремонт барака на 20% HP. Бесплатно, откат 2 мин. */
  repairBarrack(playerId: string, barrackId: string): boolean {
    const barrack = this.barracks.get(barrackId);
    if (!barrack || barrack.ownerId !== playerId || !barrack.isAlive) return false;
    return barrack.repair();
  }

  /**
   * Заклинание замка.
   * spellIndex 0: урон в прямоугольнике 100×100 (доступно с начала).
   * spellIndex 1: убийство в радиусе (доступно с замка 2 лвл).
   */
  castCastleSpell(playerId: string, castleId: string, spellIndex: 0 | 1 = 0): boolean {
    const entity = this.entities.get(castleId);
    if (!entity || entity.kind !== "castle") return false;
    const castle = entity as Castle;
    if (castle.ownerId !== playerId || !castle.isAlive) return false;

    const ps = this.playerStates.get(playerId);
    if (!ps) return false;

    if (spellIndex === 0) {
      if (castle.mana < CASTLE_SPELL_1.MANA_COST) return false;
      if (castle.spell1CooldownMs > 0) return false;

      castle.mana -= CASTLE_SPELL_1.MANA_COST;
      castle.spell1CooldownMs = CASTLE_SPELL_1.COOLDOWN_MS;

      const damage = CASTLE_SPELL_1.DAMAGE;
      const halfW = CASTLE_SPELL_1.WIDTH / 2;
      const halfH = CASTLE_SPELL_1.HEIGHT / 2;

      // Выбираем цель: здание (барак или замок) с максимальным числом врагов в радиусе 100×100
      let bestTarget = { x: castle.position.x, y: castle.position.y };
      let bestEnemyCount = 0;
      const buildingsToCheck: { x: number; y: number }[] = [{ x: castle.position.x, y: castle.position.y }];
      for (const e of this.entities.values()) {
        if (e.ownerId !== playerId || !e.isAlive) continue;
        if (e.kind === "barrack") {
          buildingsToCheck.push({ x: e.position.x, y: e.position.y });
        }
      }
      for (const b of buildingsToCheck) {
        const left = b.x - halfW;
        const right = b.x + halfW;
        const top = b.y - halfH;
        const bottom = b.y + halfH;
        let count = 0;
        for (const warrior of this.warriors.values()) {
          if (!warrior.isAlive || warrior.ownerId === playerId) continue;
          const px = warrior.position.x;
          const py = warrior.position.y;
          if (px >= left && px <= right && py >= top && py <= bottom) count++;
        }
        if (count > bestEnemyCount) {
          bestEnemyCount = count;
          bestTarget = b;
        }
      }
      const cx = bestTarget.x;
      const cy = bestTarget.y;
      const left = cx - halfW;
      const right = cx + halfW;
      const top = cy - halfH;
      const bottom = cy + halfH;

      this.spellEffects.push({
        position: { x: cx, y: cy },
        radius: 0,
        rectWidth: CASTLE_SPELL_1.WIDTH,
        rectHeight: CASTLE_SPELL_1.HEIGHT,
        ownerId: playerId,
        timeMs: this.timeMs,
      });

      for (const warrior of this.warriors.values()) {
        if (!warrior.isAlive || warrior.ownerId === playerId) continue;
        const px = warrior.position.x;
        const py = warrior.position.y;
        if (px >= left && px <= right && py >= top && py <= bottom) {
          if (warrior instanceof Hero && this.spawningEnabled) {
            this.heroProgress.set(`${warrior.ownerId}-${warrior.heroTypeId}`, {
              level: warrior.level,
              xp: warrior.xp,
            });
            this.setHeroCooldown(warrior.sourceBarrackId, warrior.heroTypeId);
          }
          warrior.takeDamage(damage);
        }
      }
      return true;
    }

    if (spellIndex === 1) {
      if (ps.castleLevel < 2) return false;
      if (castle.mana < CASTLE_SPELL_2.MANA_COST) return false;
      if (castle.spell2CooldownMs > 0) return false;

      castle.mana -= CASTLE_SPELL_2.MANA_COST;
      castle.spell2CooldownMs = CASTLE_SPELL_2.COOLDOWN_MS;

      this.spellEffects.push({
        position: { x: castle.position.x, y: castle.position.y },
        radius: CASTLE_SPELL_2.RADIUS,
        ownerId: playerId,
        timeMs: this.timeMs,
      });

      const cx = castle.position.x;
      const cy = castle.position.y;
      const r2 = CASTLE_SPELL_2.RADIUS * CASTLE_SPELL_2.RADIUS;

      for (const warrior of this.warriors.values()) {
        if (!warrior.isAlive || warrior.ownerId === playerId) continue;
        const dx = warrior.position.x - cx;
        const dy = warrior.position.y - cy;
        if (dx * dx + dy * dy <= r2) {
          if (warrior instanceof Hero && this.spawningEnabled) {
            this.heroProgress.set(`${warrior.ownerId}-${warrior.heroTypeId}`, {
              level: warrior.level,
              xp: warrior.xp,
            });
            this.setHeroCooldown(warrior.sourceBarrackId, warrior.heroTypeId);
          }
          warrior.takeDamage(warrior.maxHp);
        }
      }
      return true;
    }

    return false;
  }

  private applyBuildingUpgradesToExisting(playerId: string): void {
    const ps = this.playerStates.get(playerId);
    if (!ps) return;
    const globalMult = getBuildingUpgradeMultipliersFromLevels(ps);

    for (const entity of this.entities.values()) {
      if (entity.ownerId !== playerId || !entity.isAlive) continue;
      if (entity.kind === "castle") {
        const hpMult = globalMult.buildingHp * globalMult.castleHp;
        (entity as Castle).applyUpgrades(hpMult, globalMult.castleDamage);
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

    const globalMult = getBuildingUpgradeMultipliersFromLevels(ps);
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

  setHumanPlayerIds(ids: Set<string>): void {
    this.humanPlayerIds = ids;
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
    options?: { id?: string; warriorTypeIds?: string[]; spawnIntervalMs?: number },
  ): string | null {
    const player = this.config.players.find((p) => p.id === playerId);
    if (!player) return null;

    const warriorTypeIds = options?.warriorTypeIds ?? ["basic", "archer"];
    for (const tid of warriorTypeIds) {
      if (!this.config.warriorTypes[tid]) return null;
    }

    const id =
      options?.id ?? `barrack-${playerId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    if (this.entities.has(id)) return null;

    const barrack = new Barrack({
      id,
      ownerId: playerId,
      position: { ...position },
      maxHp: 401,
      radius: 15,
      spawnIntervalMs: options?.spawnIntervalMs ?? 15000,
      warriorTypeIds,
      resolveStatsForType: (ownerId, typeId) =>
        this.getEffectiveWarriorStats(ownerId, this.config.warriorTypes[typeId]),
      onSpawnWarrior: (warrior) => this.registerWarrior(warrior),
      canSpawn: () => this.spawningEnabled && this.playerHasAnyBuilding(playerId),
      attackRange: 80,
      attackDamage: 38,
      attackIntervalMs: 600,
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
      maxHp: 401,
      radius: 8,
      attackRange: options?.attackRange ?? 80,
      attackDamage: options?.attackDamage ?? 38,
      attackIntervalMs: 600,
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
