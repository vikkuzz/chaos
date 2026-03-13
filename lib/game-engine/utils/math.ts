import { PointLike } from "./Point";

/**
 * Ограничивает значение диапазоном [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Линейная интерполяция.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Евклидово расстояние между двумя точками.
 */
export function distance(a: PointLike, b: PointLike): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
