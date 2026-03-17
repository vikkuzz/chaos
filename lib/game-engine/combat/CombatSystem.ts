import { Point } from "../utils/Point";
import { Entity } from "../entities/Entity";
import { Castle } from "../entities/base/Castle";
import { Tower } from "../entities/base/Tower";
import { Warrior } from "../entities/units/Warrior";

function isAttacker(e: Entity): e is Castle | Tower {
  return e.kind === "castle" || e.kind === "tower";
}

/**
 * Система атаки зданий: замки и башни стреляют по вражеским воинам в радиусе.
 */
export class CombatSystem {
  update(
    entities: Map<string, Entity>,
    warriors: Iterable<Warrior>,
    _deltaTimeMs: number,
    onAttack?: (from: Point, to: Point) => void,
    onWarriorKilled?: (killerOwnerId: string, victim?: Entity) => void,
  ): void {
    const warriorList = Array.from(warriors).filter((w) => w.isAlive);

    for (const entity of entities.values()) {
      if (!entity.isAlive) continue;
      if (!isAttacker(entity)) continue;
      if (entity.attackRange <= 0 || entity.attackDamage <= 0) continue;
      if (entity.attackCooldownMs > 0) continue;

      const enemiesInRange = warriorList.filter((w) => {
        if (w.ownerId === entity.ownerId) return false;
        const dist = entity.position.distanceTo(w.position);
        return dist <= entity.attackRange;
      });

      if (enemiesInRange.length === 0) continue;

      const nearest = enemiesInRange.reduce((a, b) =>
        entity.position.distanceTo(a.position) <
        entity.position.distanceTo(b.position)
          ? a
          : b,
      );

      const wasAlive = nearest.isAlive;
      nearest.takeDamage(entity.attackDamage);
      if (wasAlive && !nearest.isAlive) {
        onWarriorKilled?.(entity.ownerId, nearest);
      }
      entity.attackCooldownMs = entity.attackIntervalMs;
      onAttack?.(entity.position, nearest.position);
    }
  }
}
