import { Point, PointLike } from "../utils/Point";

export type WaypointActionType = "move" | "attack" | "wait";

export interface WaypointProps {
  id: string;
  position: PointLike;
  action?: WaypointActionType;
  waitTimeMs?: number;
}

/**
 * Иммутабельная точка маршрута.
 */
export class Waypoint {
  public readonly id: string;
  public readonly position: Point;
  public readonly action: WaypointActionType;
  public readonly waitTimeMs: number;

  constructor(props: WaypointProps) {
    this.id = props.id;
    this.position = Point.from(props.position);
    this.action = props.action ?? "move";
    this.waitTimeMs = props.waitTimeMs ?? 0;
  }
}

/**
 * Упрощённый формат для задания маршрута из конфигов/React.
 */
export interface WaypointConfigInput {
  x: number;
  y: number;
  action?: WaypointActionType;
  waitTimeMs?: number;
}
