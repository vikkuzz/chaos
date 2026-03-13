import { Game, type GameStateSnapshot } from "../core/Game";
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

interface PurchaseOption {
  type: "upgrade" | "buildingUpgrade" | "barrackUpgrade" | "defenseWarrior";
  cost: number;
  upgradeId?: string;
  barrackId?: string;
}

/**
 * Простой алгоритм авторазвития: периодически покупает самое дешёвое
 * доступное улучшение для каждого игрока. При угрозе бараку — докупает воина.
 */
export function runAutoDevelopment(
  game: Game,
  snapshot: GameStateSnapshot,
  enabled: boolean,
  lastTickTimeMs: number,
  currentTimeMs: number,
): number {
  if (!enabled) return lastTickTimeMs;
  if (currentTimeMs - lastTickTimeMs < TICK_INTERVAL_MS) return lastTickTimeMs;

  const buyWarriorCost = Game.BUY_WARRIOR_COST;

  for (const playerId of Object.keys(snapshot.playerStates)) {
    const ps = snapshot.playerStates[playerId];
    if (!ps) continue;

    const options: PurchaseOption[] = [];

    // Приоритет: докупка воина для защиты барака от приближающихся врагов
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

    // Покупаем самое дешёвое (приоритет — защита барака)
    if (options.length > 0) {
      options.sort((a, b) => a.cost - b.cost);
      const choice = options[0];
      if (choice.type === "defenseWarrior" && choice.barrackId) {
        game.buyBarrackWarrior(playerId, choice.barrackId);
      } else if (choice.type === "barrackUpgrade" && choice.barrackId && choice.upgradeId) {
        game.buyBarrackUpgrade(playerId, choice.barrackId, choice.upgradeId);
      } else if (choice.upgradeId) {
        game.buyUpgrade(playerId, choice.upgradeId);
      }
    }
  }

  return currentTimeMs;
}
