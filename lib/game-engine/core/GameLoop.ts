export type GameLoopCallback = (deltaTimeMs: number) => void;

const TARGET_FPS = 60;
const STEP_MS = 1000 / TARGET_FPS;

/**
 * Фиксированный игровой цикл на базе requestAnimationFrame.
 */
export class GameLoop {
  private readonly callback: GameLoopCallback;
  private lastTimestamp: number | null = null;
  private accumulator = 0;
  private frameHandle: number | null = null;
  private running = false;

  constructor(callback: GameLoopCallback) {
    this.callback = callback;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = null;
    this.accumulator = 0;
    this.frameHandle = window.requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.frameHandle !== null) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private onFrame = (timestamp: number): void => {
    if (!this.running) return;

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      this.frameHandle = window.requestAnimationFrame(this.onFrame);
      return;
    }

    let delta = timestamp - this.lastTimestamp;
    if (delta > 1000) {
      delta = STEP_MS;
    }

    this.lastTimestamp = timestamp;
    this.accumulator += delta;

    while (this.accumulator >= STEP_MS) {
      this.callback(STEP_MS);
      this.accumulator -= STEP_MS;
    }

    this.frameHandle = window.requestAnimationFrame(this.onFrame);
  };
}
