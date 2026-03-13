import { Entity } from "../entities/Entity";

/**
 * Расчёт урона (учёт брони, резистов и т.п. можно добавить позже).
 */
export class DamageCalculator {
  calculateDamage(_attacker: Entity, _defender: Entity, baseDamage: number): number {
    return baseDamage;
  }
}
