import { Waypoint, WaypointConfigInput } from "./Waypoint";

export type RouteCompletionBehavior = "loop" | "despawn" | "stay";

export interface RouteManagerOptions {
  completionBehavior?: RouteCompletionBehavior;
}

/**
 * Управляет массивом Waypoint для барака.
 * Не хранит состояние конкретного юнита — только «карту» маршрута.
 */
export class RouteManager {
  private waypoints: Waypoint[] = [];
  private readonly completionBehavior: RouteCompletionBehavior;

  constructor(options?: RouteManagerOptions) {
    this.completionBehavior = options?.completionBehavior ?? "despawn";
  }

  getWaypoints(): readonly Waypoint[] {
    return this.waypoints;
  }

  setWaypoints(configs: WaypointConfigInput[]): void {
    this.waypoints = configs.map(
      (cfg, index) =>
        new Waypoint({
          id: cfg.action ?? `wp-${index}`,
          position: { x: cfg.x, y: cfg.y },
          action: cfg.action,
          waitTimeMs: cfg.waitTimeMs,
        }),
    );
  }

  addWaypoint(config: WaypointConfigInput): void {
    const index = this.waypoints.length;
    this.waypoints.push(
      new Waypoint({
        id: config.action ?? `wp-${index}`,
        position: { x: config.x, y: config.y },
        action: config.action,
        waitTimeMs: config.waitTimeMs,
      }),
    );
  }

  removeWaypoint(index: number): void {
    if (index < 0 || index >= this.waypoints.length) return;
    this.waypoints.splice(index, 1);
  }

  getWaypoint(index: number): Waypoint | undefined {
    if (index < 0 || index >= this.waypoints.length) return undefined;
    return this.waypoints[index];
  }

  /**
   * Возвращает следующий waypoint и его индекс, либо null если маршрут закончен.
   */
  getNextWaypoint(currentIndex: number): { index: number; waypoint: Waypoint } | null {
    if (this.waypoints.length === 0) return null;

    const nextIndex = currentIndex + 1;

    if (nextIndex < this.waypoints.length) {
      const waypoint = this.waypoints[nextIndex];
      return { index: nextIndex, waypoint };
    }

    if (this.completionBehavior === "loop") {
      const waypoint = this.waypoints[0];
      return { index: 0, waypoint };
    }

    return null;
  }

  clone(): RouteManager {
    const clone = new RouteManager({ completionBehavior: this.completionBehavior });
    clone.waypoints = this.waypoints.slice();
    return clone;
  }
}
