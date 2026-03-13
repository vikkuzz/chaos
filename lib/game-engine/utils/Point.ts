export interface PointLike {
  x: number;
  y: number;
}

/**
 * Простой 2D-вектор для работы с координатами на поле.
 */
export class Point implements PointLike {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  static from(point: PointLike): Point {
    return new Point(point.x, point.y);
  }

  clone(): Point {
    return new Point(this.x, this.y);
  }

  add(other: PointLike): Point {
    return new Point(this.x + other.x, this.y + other.y);
  }

  sub(other: PointLike): Point {
    return new Point(this.x - other.x, this.y - other.y);
  }

  scale(factor: number): Point {
    return new Point(this.x * factor, this.y * factor);
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  normalize(): Point {
    const len = this.length();
    if (len === 0) return new Point(0, 0);
    return this.scale(1 / len);
  }

  distanceTo(other: PointLike): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.hypot(dx, dy);
  }

  equals(other: PointLike): boolean {
    return this.x === other.x && this.y === other.y;
  }

  lerp(to: PointLike, t: number): Point {
    return new Point(this.x + (to.x - this.x) * t, this.y + (to.y - this.y) * t);
  }
}
