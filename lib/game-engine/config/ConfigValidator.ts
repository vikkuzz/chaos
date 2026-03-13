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
}
