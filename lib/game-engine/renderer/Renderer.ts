import { GameStateSnapshot } from "../core/Game";

/**
 * Абстракция над рендерингом (Canvas, WebGL, p5 и т.п.).
 */
export interface Renderer {
  render(state: GameStateSnapshot, viewport?: unknown, currentPlayerId?: string | null): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
