import { GameStateSnapshot } from "../core/Game";

/**
 * Абстракция над рендерингом (Canvas, WebGL, p5 и т.п.).
 */
export interface FogData {
  visibleCells: Set<string>;
  revealedCells: Set<string>;
  lastKnownEnemies: Map<string, import("../core/Game").EntitySnapshot>;
}

export interface Renderer {
  render(
    state: GameStateSnapshot,
    viewport?: unknown,
    currentPlayerId?: string | null,
    fogData?: FogData | null,
  ): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
