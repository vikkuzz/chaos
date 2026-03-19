import { Game, type GameStateSnapshot, type CastleUpgradeTrack } from "../core/Game";
import { CASTLE_SPELL_1, CASTLE_SPELL_2 } from "../entities/base/Castle";
import {
  getBarrackUpgradeCost,
  getCastleUpgradeCost,
  getTrackUpgradeCost,
  getMaxTrackLevel,
  getMaxMagicLevel,
  BARRACK_MAX_LEVEL,
} from "../upgrades/definitions";

const TICK_INTERVAL_MS = 2500;

/** Радиус, в котором враги считаются «приближающимися» к бараку. */
const THREAT_RADIUS = 150;
/** Радиус, в котором дружественные воины считаются защищающими барак. */
const DEFENSE_RADIUS = 100;
/** Минимальный уровень замка для вызова героя (чтобы ИИ сначала прокачивал базу). */
const AI_HERO_MIN_CASTLE_LEVEL = 1;
/** Золотой резерв: герой вызывается только при gold >= heroCost + AI_HERO_GOLD_RESERVE. */
const AI_HERO_GOLD_RESERVE = 300;
/** Вероятность (0..1) пропустить вызов героя в тик, чтобы ИИ чаще вкладывался в базу. */
const AI_HERO_SKIP_PROBABILITY = 0.3;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/**
 * Проверяет, нужна ли бараку срочная докупка воина:
 * враги приближаются, друзей рядом нет, есть деньги и слот.
 */
function barrackNeedsDefense(
  barrack: { id: string; ownerId: string; position: { x: number; y: number } },
  entities: readonly { kind: string; ownerId: string; position: { x: number; y: number } }[],
  barrackBuyCapacity: Record<string, { current: number; max: number }> | undefined,
): boolean {
  const capacity = barrackBuyCapacity?.[barrack.id];
  if (!capacity || capacity.current <= 0) return false;

  const bx = barrack.position.x;
  const by = barrack.position.y;

  let hasEnemyNearby = false;
  let hasFriendlyNearby = false;

  for (const e of entities) {
    if (!e.position || e.kind !== "warrior") continue;
    const d = dist(bx, by, e.position.x, e.position.y);
    if (e.ownerId === barrack.ownerId) {
      if (d < DEFENSE_RADIUS) hasFriendlyNearby = true;
    } else {
      if (d < THREAT_RADIUS) hasEnemyNearby = true;
    }
  }

  return hasEnemyNearby && !hasFriendlyNearby;
}

/** Есть ли враги в радиусе заклинания 2 (150) вокруг замка. */
function baseUnderThreat(
  castle: { id: string; ownerId: string; position: { x: number; y: number } },
  entities: readonly { kind: string; ownerId: string; position?: { x: number; y: number } }[],
): boolean {
  const cx = castle.position.x;
  const cy = castle.position.y;
  const r2 = CASTLE_SPELL_2.RADIUS * CASTLE_SPELL_2.RADIUS;
  for (const e of entities) {
    if (!e.position || e.kind !== "warrior" || e.ownerId === castle.ownerId) continue;
    const dx = e.position.x - cx;
    const dy = e.position.y - cy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/** Есть ли враги в области 100×100 вокруг любого здания игрока (для заклинания 1). */
function anyBuildingUnderThreatForSpell1(
  playerId: string,
  entities: readonly { kind: string; ownerId: string; position?: { x: number; y: number } }[],
): boolean {
  const halfW = CASTLE_SPELL_1.WIDTH / 2;
  const halfH = CASTLE_SPELL_1.HEIGHT / 2;
  for (const e of entities) {
    if (!e.position || (e.kind !== "castle" && e.kind !== "barrack") || e.ownerId !== playerId) continue;
    if (!(e as { isAlive?: boolean }).isAlive) continue;
    const left = e.position.x - halfW;
    const right = e.position.x + halfW;
    const top = e.position.y - halfH;
    const bottom = e.position.y + halfH;
    for (const w of entities) {
      if (!w.position || w.kind !== "warrior" || w.ownerId === playerId) continue;
      if (!(w as { isAlive?: boolean }).isAlive) continue;
      const px = w.position.x;
      const py = w.position.y;
      if (px >= left && px <= right && py >= top && py <= bottom) return true;
    }
  }
  return false;
}

interface PurchaseOption {
  type: "castleUpgrade" | "barrackUpgrade" | "defenseWarrior" | "repairBarrack" | "castSpell1" | "castSpell2" | "summonHero";
  cost: number;
  trackId?: CastleUpgradeTrack;
  upgradeId?: string;
  barrackId?: string;
  castleId?: string;
  heroTypeId?: string;
}

/**
 * Простой алгоритм авторазвития: периодически покупает самое дешёвое
 * доступное улучшение для каждого игрока. При угрозе бараку — докупает воина.
 * humanPlayerIds — игроки под управлением человека (в локальном режиме — выбранный игрок).
 * enabled — авторазвитие для человека (переключатель). При отключении — только человек не тратит, боты продолжают.
 */
export function runAutoDevelopment(
  game: Game,
  snapshot: GameStateSnapshot,
  enabled: boolean,
  lastTickTimeMs: number,
  currentTimeMs: number,
  humanPlayerIds: Set<string> = new Set(),
): number {
  if (currentTimeMs - lastTickTimeMs < TICK_INTERVAL_MS) return lastTickTimeMs;

  const buyWarriorCost = Game.BUY_WARRIOR_COST;

  for (const playerId of Object.keys(snapshot.playerStates)) {
    // Пропускаем человека только когда авторазвитие для него отключено
    if (humanPlayerIds.has(playerId) && !enabled) continue;
    if (!game.playerHasAnyBuilding(playerId)) continue; // Без зданий — не тратим
    const ps = snapshot.playerStates[playerId];
    if (!ps) continue;

    const options: PurchaseOption[] = [];

    // Приоритет 0: заклинание замка при угрозе базе
    for (const entity of snapshot.entities) {
      if (
        entity.kind !== "castle" ||
        entity.ownerId !== playerId ||
        !entity.isAlive
      )
        continue;
      const mana = (entity as { mana?: number }).mana ?? 0;
      const spell1Cd = (entity as { spell1CooldownMs?: number }).spell1CooldownMs ?? 0;
      const spell2Cd = (entity as { spell2CooldownMs?: number }).spell2CooldownMs ?? 0;
      const castleLevel = ps.castleLevel ?? 0;

      if (anyBuildingUnderThreatForSpell1(playerId, snapshot.entities)) {
        if (mana >= CASTLE_SPELL_1.MANA_COST && spell1Cd <= 0) {
          options.push({ type: "castSpell1", cost: 0, castleId: entity.id });
        }
      }
      if (baseUnderThreat(entity, snapshot.entities)) {
        if (castleLevel >= 2 && mana >= CASTLE_SPELL_2.MANA_COST && spell2Cd <= 0) {
          options.push({ type: "castSpell2", cost: 0, castleId: entity.id });
        }
      }
    }

    // Приоритет 1: докупка воина для защиты барака от приближающихся врагов
    for (const entity of snapshot.entities) {
      if (
        entity.kind !== "barrack" ||
        entity.ownerId !== playerId ||
        !entity.isAlive
      )
        continue;
      if (
        barrackNeedsDefense(entity, snapshot.entities, snapshot.barrackBuyCapacity) &&
        ps.gold >= buyWarriorCost
      ) {
        options.push({
          type: "defenseWarrior",
          cost: 0, // наивысший приоритет
          barrackId: entity.id,
        });
      }
    }

    // Приоритет 2: вызов героя (только при прокачанном замке, с резервом золота и не каждый тик)
    const heroCost = Game.HERO_SUMMON_COST;
    const heroTypes = game.config.heroTypes ?? {};
    const heroTypeIds = Object.keys(heroTypes) as string[];
    const aliveHeroTypeIds = new Set(
      snapshot.entities
        .filter((e) => e.kind === "warrior" && (e as { isHero?: boolean }).isHero && e.ownerId === playerId && e.isAlive)
        .map((e) => (e as { heroTypeId?: string }).heroTypeId)
        .filter((id): id is string => !!id),
    );
    const castleLevel = ps.castleLevel ?? 0;
    const canAffordHeroWithReserve = ps.gold >= heroCost + AI_HERO_GOLD_RESERVE;
    const heroAllowedByChance = Math.random() > AI_HERO_SKIP_PROBABILITY;
    if (
      heroTypeIds.length > 0 &&
      castleLevel >= AI_HERO_MIN_CASTLE_LEVEL &&
      canAffordHeroWithReserve &&
      heroAllowedByChance
    ) {
      summonLoop: for (const entity of snapshot.entities) {
        if (entity.kind !== "barrack" || entity.ownerId !== playerId || !entity.isAlive) continue;
        for (const heroTypeId of heroTypeIds) {
          if (aliveHeroTypeIds.has(heroTypeId)) continue;
          if (!game.canSummonHero(playerId, entity.id, heroTypeId)) continue;
          options.push({
            type: "summonHero",
            cost: heroCost,
            barrackId: entity.id,
            heroTypeId,
          });
          break summonLoop; // Один вариант вызова героя за тик
        }
      }
    }

    // Приоритет 3: ремонт повреждённых бараков (бесплатно, откат 2 мин)
    const barrackRepairCooldown = snapshot.barrackRepairCooldownMs ?? {};
    for (const entity of snapshot.entities) {
      if (
        entity.kind !== "barrack" ||
        entity.ownerId !== playerId ||
        !entity.isAlive
      )
        continue;
      if (
        entity.hp < entity.maxHp &&
        (barrackRepairCooldown[entity.id] ?? 0) <= 0
      ) {
        options.push({
          type: "repairBarrack",
          cost: 1, // после defense, до платных улучшений
          barrackId: entity.id,
        });
      }
    }

    // Улучшения замка (уровневая система) — только если есть живой замок
    const hasLivingCastle = snapshot.entities.some(
      (e) => e.ownerId === playerId && e.isAlive && e.kind === "castle",
    );
    const maxTrack = getMaxTrackLevel(castleLevel);
    const maxMagic = getMaxMagicLevel(castleLevel);

    const tracks: CastleUpgradeTrack[] = ["castle", "ranged", "melee", "buildingHp", "unitHp", "unitDefense", "magic"];
    const getLevel = (t: CastleUpgradeTrack): number => {
      switch (t) {
        case "castle": return ps.castleLevel;
        case "ranged": return ps.rangedLevel;
        case "melee": return ps.meleeLevel;
        case "buildingHp": return ps.buildingHpLevel;
        case "unitHp": return ps.unitHpLevel;
        case "unitDefense": return ps.unitDefenseLevel;
        case "magic": return ps.magicLevel;
        default: return 0;
      }
    };
    for (const trackId of tracks) {
      if (!hasLivingCastle) continue;
      const level = getLevel(trackId);
      const maxLevel = trackId === "castle" ? 3 : trackId === "magic" ? maxMagic : maxTrack;
      if (level >= maxLevel) continue;
      const cost = trackId === "castle" ? getCastleUpgradeCost(level) : getTrackUpgradeCost(level);
      if (cost != null && ps.gold >= cost) {
        options.push({ type: "castleUpgrade", cost, trackId });
      }
    }

    // Улучшения бараков (уровневая система)
    const barrackLevels = snapshot.barrackLevels ?? {};
    for (const entity of snapshot.entities) {
      if (entity.kind !== "barrack" || entity.ownerId !== playerId || !entity.isAlive) continue;
      const level = barrackLevels[entity.id] ?? 0;
      if (level >= BARRACK_MAX_LEVEL) continue;
      const cost = getBarrackUpgradeCost(level);
      if (cost != null && ps.gold >= cost) {
        options.push({
          type: "barrackUpgrade",
          cost,
          barrackId: entity.id,
        });
      }
    }

    // Покупаем/выполняем самое приоритетное действие
    if (options.length > 0) {
      options.sort((a, b) => a.cost - b.cost);
      const choice = options[0];
      if (choice.type === "castSpell1" && choice.castleId) {
        game.castCastleSpell(playerId, choice.castleId, 0);
      } else if (choice.type === "castSpell2" && choice.castleId) {
        game.castCastleSpell(playerId, choice.castleId, 1);
      } else if (choice.type === "defenseWarrior" && choice.barrackId) {
        game.buyBarrackWarrior(playerId, choice.barrackId);
      } else if (choice.type === "summonHero" && choice.barrackId && choice.heroTypeId) {
        game.summonHero(playerId, choice.barrackId, choice.heroTypeId);
      } else if (choice.type === "repairBarrack" && choice.barrackId) {
        game.repairBarrack(playerId, choice.barrackId);
      } else if (choice.type === "barrackUpgrade" && choice.barrackId) {
        game.buyBarrackUpgrade(playerId, choice.barrackId);
      } else if (choice.type === "castleUpgrade" && choice.trackId) {
        game.buyCastleUpgrade(playerId, choice.trackId);
      }
    }
  }

  return currentTimeMs;
}
