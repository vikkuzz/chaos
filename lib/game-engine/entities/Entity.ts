import { Point, PointLike } from "../utils/Point";

export type EntityId = string;
export type PlayerId = string;

export type EntityKind = "castle" | "barrack" | "tower" | "warrior" | "base";

export interface EntityProps {
  id: EntityId;
  ownerId: PlayerId;
  kind: EntityKind;
  position: PointLike;
  maxHp: number;
  radius: number;
}

/**
 * Базовый класс всех игровых сущностей.
 * Логика специфичных типов выносится в наследников или в системы.
 */
export abstract class Entity {
  public readonly id: EntityId;
  public readonly ownerId: PlayerId;
  public readonly kind: EntityKind;
  public position: Point;
  protected _maxHp: number;
  public radius: number;

  protected _hp: number;

  constructor(props: EntityProps) {
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.kind = props.kind;
    this.position = Point.from(props.position);
    this._maxHp = props.maxHp;
    this._hp = props.maxHp;
    this.radius = props.radius;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  /**
   * Обновить maxHp, сохраняя долю текущего HP.
   * Используется при применении апгрейдов к воинам.
   */
  applyMaxHpChange(newMaxHp: number): void {
    if (this._maxHp <= 0) return;
    const ratio = this._hp / this._maxHp;
    this._maxHp = newMaxHp;
    this._hp = Math.round(ratio * newMaxHp);
  }

  get hp(): number {
    return this._hp;
  }

  get isAlive(): boolean {
    return this._hp > 0;
  }

  takeDamage(amount: number): void {
    this._hp = Math.max(0, this._hp - amount);
  }

  heal(amount: number): void {
    this._hp = Math.min(this.maxHp, this._hp + amount);
  }

  /**
   * Обновление логики сущности за дельту времени (мс).
   */
  abstract update(deltaTimeMs: number): void;
}
