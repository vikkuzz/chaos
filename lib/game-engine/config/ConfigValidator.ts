import { GameConfig } from "./defaultConfig";

/**
 * Минимальная валидация конфига (можно расширить при необходимости).
 */
export function validateGameConfig(config: GameConfig): void {
  if (config.mapWidth <= 0 || config.mapHeight <= 0) {
    throw new Error("GameConfig: mapWidth и mapHeight должны быть > 0.");
  }

  if (config.players.length === 0) {
    throw new Error("GameConfig: должен быть как минимум один игрок.");
  }

  // Базовая проверка типов воинов.
  for (const player of config.players) {
    for (const barrack of player.barracks) {
      if (!config.warriorTypes[barrack.warriorTypeId]) {
        throw new Error(
          `GameConfig: warriorTypeId "${barrack.warriorTypeId}" не определён в warriorTypes.`,
        );
      }
    }
  }

  if (config.neutralPoints) {
    const ids = new Set<string>();
    for (const pt of config.neutralPoints) {
      if (ids.has(pt.id)) {
        throw new Error(`GameConfig: neutralPoints: дублирующий id "${pt.id}".`);
      }
      ids.add(pt.id);
      if (pt.radius <= 0 || pt.captureRadius <= 0) {
        throw new Error(`GameConfig: neutralPoints "${pt.id}": radius и captureRadius должны быть > 0.`);
      }
      if (pt.position.x < 0 || pt.position.x > config.mapWidth || pt.position.y < 0 || pt.position.y > config.mapHeight) {
        throw new Error(`GameConfig: neutralPoints "${pt.id}": позиция вне границ карты.`);
      }
    }
  }
}
