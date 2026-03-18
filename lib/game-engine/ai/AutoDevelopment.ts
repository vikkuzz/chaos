import { Game, type GameStateSnapshot } from "../core/Game";
import { CASTLE_SPELL } from "../entities/base/Castle";
import {
  UPGRADE_DEFINITIONS,
  BUILDING_UPGRADE_DEFINITIONS,
  BARACK_UPGRADE_DEFINITIONS,
} from "../upgrades/definitions";

const TICK_INTERVAL_MS = 2500;

/** Радиус, в котором враги считаются «приближающимися» к бараку. */
const THREAT_RADIUS = 150;
/** Радиус, в котором дружественные воины считаются защищающими барак. */
const DEFENSE_RADIUS = 100;

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

/**
 * Есть ли враги в радиусе заклинания замка (угроза базе).
 */
function baseUnderThreat(
  castle: { id: string; ownerId: string; position: { x: number; y: number } },
  entities: readonly { kind: string; ownerId: string; position?: { x: number; y: number } }[],
): boolean {
  const cx = castle.position.x;
  const cy = castle.position.y;
  const r2 = CASTLE_SPELL.SPELL_RADIUS * CASTLE_SPELL.SPELL_RADIUS;

  for (const e of entities) {
    if (!e.position || e.kind !== "warrior" || e.ownerId === castle.ownerId) continue;
    const dx = e.position.x - cx;
    const dy = e.position.y - cy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

interface PurchaseOption {
  type: "upgrade" | "buildingUpgrade" | "barrackUpgrade" | "defenseWarrior" | "repairBarrack" | "castSpell" | "summonHero";
  cost: number;
  upgradeId?: string;
  barrackId?: string;
  castleId?: string;
  heroTypeId?: string;
}

/**
 * Простой алгоритм авторазвития: периодически покупает самое дешёвое
 * доступное улучшение для каждого игрока. При угрозе бараку — докупает воина.
 * humanPlayerIds — игроки под управлением человека.
 * enabled — авторазвитие для человека (переключатель в UI). Боты всегда развиваются автоматически.
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
    // Пропускаем человека, только когда авторазвитие для него отключено
    if (humanPlayerIds.has(playerId) && !enabled) continue;
    const ps = snapshot.playerStates[playerId];
    if (!ps) continue;

    const options: PurchaseOption[] = [];

    // Приоритет 0: заклинание замка при угрозе базе (враги в радиусе заклинания)
    for (const entity of snapshot.entities) {
      if (
        entity.kind !== "castle" ||
        entity.ownerId !== playerId ||
        !entity.isAlive
      )
        continue;
      const mana = (entity as { mana?: number }).mana ?? 0;
      const spellCooldownMs = (entity as { spellCooldownMs?: number }).spellCooldownMs ?? 0;
      if (
        baseUnderThreat(entity, snapshot.entities) &&
        mana >= CASTLE_SPELL.SPELL_COST &&
        spellCooldownMs <= 0
      ) {
        options.push({
          type: "castSpell",
          cost: 0,
          castleId: entity.id,
        });
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

    // Приоритет 2: вызов героя (если есть золото и герой не на поле)
    const heroCost = Game.HERO_SUMMON_COST;
    const heroTypes = game.config.heroTypes ?? {};
    const heroTypeIds = Object.keys(heroTypes) as string[];
    const aliveHeroTypeIds = new Set(
      snapshot.entities
        .filter((e) => e.kind === "warrior" && (e as { isHero?: boolean }).isHero && e.ownerId === playerId && e.isAlive)
        .map((e) => (e as { heroTypeId?: string }).heroTypeId)
        .filter((id): id is string => !!id),
    );
    const barrackHeroCooldowns = snapshot.barrackHeroCooldowns ?? {};
    if (heroTypeIds.length > 0 && ps.gold >= heroCost) {
      summonLoop: for (const entity of snapshot.entities) {
        if (entity.kind !== "barrack" || entity.ownerId !== playerId || !entity.isAlive) continue;
        for (const heroTypeId of heroTypeIds) {
          if (aliveHeroTypeIds.has(heroTypeId)) continue;
          const cooldowns = barrackHeroCooldowns[entity.id] ?? {};
          if ((cooldowns[heroTypeId] ?? 0) > 0) continue;
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

    // Глобальные улучшения воинов
    for (const def of UPGRADE_DEFINITIONS) {
      if (ps.upgradeIds.includes(def.id)) continue;
      if (def.prerequisiteId && !ps.upgradeIds.includes(def.prerequisiteId)) continue;
      if (ps.gold >= def.cost) {
        options.push({ type: "upgrade", cost: def.cost, upgradeId: def.id });
      }
    }

    // Глобальные улучшения зданий
    for (const def of BUILDING_UPGRADE_DEFINITIONS) {
      if (ps.buildingUpgradeIds.includes(def.id)) continue;
      if (def.prerequisiteId && !ps.buildingUpgradeIds.includes(def.prerequisiteId)) continue;
      if (ps.gold >= def.cost) {
        options.push({ type: "buildingUpgrade", cost: def.cost, upgradeId: def.id });
      }
    }

    // Улучшения бараков
    const barrackUpgrades = snapshot.barrackUpgrades ?? {};
    for (const entity of snapshot.entities) {
      if (entity.kind !== "barrack" || entity.ownerId !== playerId || !entity.isAlive) continue;
      const barrackIds = barrackUpgrades[entity.id] ?? [];
      for (const def of BARACK_UPGRADE_DEFINITIONS) {
        if (barrackIds.includes(def.id)) continue;
        if (def.prerequisiteId && !barrackIds.includes(def.prerequisiteId)) continue;
        if (ps.gold >= def.cost) {
          options.push({
            type: "barrackUpgrade",
            cost: def.cost,
            upgradeId: def.id,
            barrackId: entity.id,
          });
        }
      }
    }

    // Покупаем/выполняем самое приоритетное действие
    if (options.length > 0) {
      options.sort((a, b) => a.cost - b.cost);
      const choice = options[0];
      if (choice.type === "castSpell" && choice.castleId) {
        game.castCastleSpell(playerId, choice.castleId);
      } else if (choice.type === "defenseWarrior" && choice.barrackId) {
        game.buyBarrackWarrior(playerId, choice.barrackId);
      } else if (choice.type === "summonHero" && choice.barrackId && choice.heroTypeId) {
        game.summonHero(playerId, choice.barrackId, choice.heroTypeId);
      } else if (choice.type === "repairBarrack" && choice.barrackId) {
        game.repairBarrack(playerId, choice.barrackId);
      } else if (choice.type === "barrackUpgrade" && choice.barrackId && choice.upgradeId) {
        game.buyBarrackUpgrade(playerId, choice.barrackId, choice.upgradeId);
      } else if (choice.upgradeId) {
        game.buyUpgrade(playerId, choice.upgradeId);
      }
    }
  }

  return currentTimeMs;
}
