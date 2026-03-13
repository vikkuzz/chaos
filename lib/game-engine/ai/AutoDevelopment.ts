import type { Game } from "../core/Game";
import type { GameStateSnapshot } from "../core/Game";
import {
  UPGRADE_DEFINITIONS,
  BUILDING_UPGRADE_DEFINITIONS,
  BARACK_UPGRADE_DEFINITIONS,
} from "../upgrades/definitions";

const TICK_INTERVAL_MS = 2500;

interface PurchaseOption {
  type: "upgrade" | "buildingUpgrade" | "barrackUpgrade";
  cost: number;
  upgradeId: string;
  barrackId?: string;
}

/**
 * Простой алгоритм авторазвития: периодически покупает самое дешёвое
 * доступное улучшение для каждого игрока.
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

  for (const playerId of Object.keys(snapshot.playerStates)) {
    const ps = snapshot.playerStates[playerId];
    if (!ps) continue;

    const options: PurchaseOption[] = [];

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

    // Покупаем самое дешёвое
    if (options.length > 0) {
      options.sort((a, b) => a.cost - b.cost);
      const choice = options[0];
      if (choice.type === "barrackUpgrade" && choice.barrackId) {
        game.buyBarrackUpgrade(playerId, choice.barrackId, choice.upgradeId);
      } else {
        game.buyUpgrade(playerId, choice.upgradeId);
      }
    }
  }

  return currentTimeMs;
}
