import { Entity } from "../entities/Entity";
import { Warrior } from "../entities/units/Warrior";
import { Point, type PointLike } from "../utils/Point";

/**
 * Движение воинов по маршруту + логика атаки.
 * Воины обнаруживают врагов в радиусе detectionRadius, движутся к ним и атакуют вплотную.
 */
export class MovementSystem {
  update(
    warriors: Iterable<Warrior>,
    allEntities: Map<string, Entity>,
    deltaTimeMs: number,
    onWarriorKilled?: (killerOwnerId: string) => void,
    onWarriorAttack?: (from: PointLike, to: PointLike) => void,
  ): void {
    const deltaSeconds = deltaTimeMs / 1000;
    const entitiesList = Array.from(allEntities.values());

    for (const warrior of warriors) {
      if (!warrior.isAlive) continue;

      const detectionRadius = warrior.stats.detectionRadius ?? 80;
      const attackRange = warrior.stats.attackRange;
      const attackIntervalMs = warrior.stats.attackIntervalMs ?? 400;

      const enemies = entitiesList.filter(
        (e) =>
          e.isAlive &&
          e.ownerId !== warrior.ownerId &&
          (e.kind === "warrior" ||
            e.kind === "castle" ||
            e.kind === "barrack" ||
            e.kind === "tower"),
      );

      const enemiesInDetection = enemies.filter((e) => {
        const dist = warrior.position.distanceTo(e.position);
        return dist <= detectionRadius;
      });

      const nearestEnemy = enemiesInDetection.length > 0
        ? enemiesInDetection.reduce((a, b) =>
            warrior.position.distanceTo(a.position) <
            warrior.position.distanceTo(b.position)
              ? a
              : b,
          )
        : null;

      if (nearestEnemy) {
        const distToEnemy = warrior.position.distanceTo(nearestEnemy.position);

        if (distToEnemy <= attackRange && warrior.attackCooldownMs <= 0) {
          onWarriorAttack?.(warrior.position, nearestEnemy.position);
          const wasWarrior = nearestEnemy.kind === "warrior";
          const wasAlive = nearestEnemy.isAlive;
          nearestEnemy.takeDamage(warrior.stats.attackDamage);
          if (wasWarrior && wasAlive && !nearestEnemy.isAlive) {
            onWarriorKilled?.(warrior.ownerId);
          }
          warrior.attackCooldownMs = attackIntervalMs;
          continue;
        }

        if (distToEnemy > attackRange) {
          const toTarget = Point.from(nearestEnemy.position).sub(warrior.position);
          const direction = toTarget.length() > 0 ? toTarget.normalize() : new Point(0, 0);
          const maxTravel = warrior.stats.speed * deltaSeconds;
          warrior.position = warrior.position.add(direction.scale(maxTravel));
        }
        continue;
      }

      const routeManager = warrior.routeManager;
      const currentWaypoint = routeManager.getWaypoint(warrior.currentWaypointIndex);

      if (!currentWaypoint) continue;

      const target = currentWaypoint.position;
      const toTarget = target.sub(warrior.position);
      const distanceToTarget = toTarget.length();

      if (distanceToTarget === 0) {
        const next = routeManager.getNextWaypoint(warrior.currentWaypointIndex);
        if (next === null) {
          warrior.takeDamage(warrior.maxHp);
        } else {
          warrior.currentWaypointIndex = next.index;
        }
        continue;
      }

      const maxTravel = warrior.stats.speed * deltaSeconds;

      if (maxTravel >= distanceToTarget) {
        warrior.position = target.clone();
        const next = routeManager.getNextWaypoint(warrior.currentWaypointIndex);
        if (next === null) {
          warrior.takeDamage(warrior.maxHp);
        } else {
          warrior.currentWaypointIndex = next.index;
        }
      } else {
        const direction = toTarget.normalize();
        warrior.position = warrior.position.add(direction.scale(maxTravel));
      }
    }
  }
}
