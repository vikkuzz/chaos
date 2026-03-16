export type GameLoopCallback = (deltaTimeMs: number) => void;

const TARGET_FPS = 60;
const STEP_MS = 1000 / TARGET_FPS;

/**
 * Игровой цикл для сервера на базе setInterval.
 * Аналог GameLoop, но без requestAnimationFrame (Node.js).
 */
export class ServerGameLoop {
  private readonly callback: GameLoopCallback;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(callback: GameLoopCallback) {
    this.callback = callback;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.intervalId = setInterval(() => {
      this.callback(STEP_MS);
    }, STEP_MS);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
