import { Entity } from "../entities/Entity";
import { Warrior } from "../entities/units/Warrior";
import { Hero } from "../entities/units/Hero";
import { Point, type PointLike } from "../utils/Point";

/** Радиус, в котором юниты переключаются на защиту героя. */
const DEFEND_HERO_RADIUS = 120;

/** Минимальный зазор между окружностями юнитов после разделения (px). */
const UNIT_SEPARATION_MARGIN = 2;
/** Сколько раз за кадр разрешать наложения (соседи по цепочке). */
const UNIT_SEPARATION_ITERATIONS = 4;

export interface HeroUnderAttack {
  attacker: Warrior;
  heroOwnerId: string;
  heroPosition: PointLike;
  timeMs: number;
}

/**
 * Движение воинов по маршруту + логика атаки.
 * Воины обнаруживают врагов в радиусе detectionRadius, движутся к ним и атакуют вплотную.
 * При атаке дружественного героя — ближайшие юниты переагриваются на атакующего.
 */
export class MovementSystem {
  update(
    warriors: Iterable<Warrior>,
    allEntities: Map<string, Entity>,
    deltaTimeMs: number,
    onWarriorKilled?: (killerOwnerId: string, victim?: Entity) => void,
    onWarriorAttack?: (from: PointLike, to: PointLike) => void,
    heroUnderAttackRef?: { current: HeroUnderAttack | null },
    currentTimeMs?: number,
  ): void {
    const deltaSeconds = deltaTimeMs / 1000;
    const entitiesList = Array.from(allEntities.values());
    // Map.values() — одноразовый итератор: нельзя сначала for..of, потом снова тот же iterable.
    const warriorList = Array.from(warriors);

    for (const warrior of warriorList) {
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

      // Переагривание: если атакуют нашего героя — ближайшие юниты целятся в атакующего
      let nearestEnemy: Entity | null = enemiesInDetection.length > 0
        ? enemiesInDetection.reduce((a, b) =>
            warrior.position.distanceTo(a.position) <
            warrior.position.distanceTo(b.position)
              ? a
              : b,
          )
        : null;

      const defendTarget = heroUnderAttackRef?.current;
      if (defendTarget && defendTarget.attacker.isAlive) {
        const heroOwnerId = defendTarget.heroOwnerId;
        const attacker = defendTarget.attacker;
        const distToHero = warrior.position.distanceTo(defendTarget.heroPosition);
        const distToAttacker = warrior.position.distanceTo(attacker.position);
        if (
          warrior.ownerId === heroOwnerId &&
          distToHero <= DEFEND_HERO_RADIUS &&
          distToAttacker <= detectionRadius &&
          attacker.ownerId !== warrior.ownerId &&
          enemies.some((e) => e.id === attacker.id)
        ) {
          nearestEnemy = attacker;
        }
      }

      if (nearestEnemy) {
        const distToEnemy = warrior.position.distanceTo(nearestEnemy.position);

        if (distToEnemy <= attackRange && warrior.attackCooldownMs <= 0) {
          onWarriorAttack?.(warrior.position, nearestEnemy.position);
          const wasWarrior = nearestEnemy.kind === "warrior";
          const wasAlive = nearestEnemy.isAlive;
          nearestEnemy.takeDamage(warrior.stats.attackDamage);
          if (wasAlive && !nearestEnemy.isAlive) {
            onWarriorKilled?.(warrior.ownerId, nearestEnemy);
          }
          if (nearestEnemy instanceof Hero && nearestEnemy.ownerId !== warrior.ownerId) {
            heroUnderAttackRef && currentTimeMs !== undefined && (heroUnderAttackRef.current = {
              attacker: warrior,
              heroOwnerId: nearestEnemy.ownerId,
              heroPosition: nearestEnemy.position,
              timeMs: currentTimeMs,
            });
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

    this.applyWarriorSeparation(warriorList);
  }

  /**
   * Мягкое раздвижение всех воинов, если круги пересекаются (в т.ч. враги).
   * Раньше только союзники — из‑за этого при столкновении армий MARGIN «не работал» визуально.
   */
  private applyWarriorSeparation(warriors: Iterable<Warrior>): void {
    const list = Array.from(warriors).filter((w) => w.isAlive);
    if (list.length < 2) return;

    for (let iter = 0; iter < UNIT_SEPARATION_ITERATIONS; iter++) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (!a.isAlive || !b.isAlive) continue;

          const minDist = a.radius + b.radius + UNIT_SEPARATION_MARGIN;
          const dx = b.position.x - a.position.x;
          const dy = b.position.y - a.position.y;
          let dist = Math.hypot(dx, dy);

          if (dist >= minDist) continue;

          let nx: number;
          let ny: number;
          if (dist < 1e-6) {
            const t = (i * 7 + j * 13) * 0.618033988749895;
            nx = Math.cos(t);
            ny = Math.sin(t);
          } else {
            nx = dx / dist;
            ny = dy / dist;
          }

          const overlap = dist < 1e-6 ? minDist : minDist - dist;
          const half = overlap / 2;
          a.position.x -= nx * half;
          a.position.y -= ny * half;
          b.position.x += nx * half;
          b.position.y += ny * half;
        }
      }
    }
  }
}
