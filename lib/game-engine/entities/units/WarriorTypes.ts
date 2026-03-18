export interface WarriorStats {
  maxHp: number;
  speed: number; // единиц в секунду
  attackDamage: number;
  attackRange: number;
  /** Радиус обнаружения врагов. Враги в этом радиусе привлекают воина. */
  detectionRadius?: number;
  /** Интервал между атаками (мс). */
  attackIntervalMs?: number;
  /** Снижение входящего урона (0–1). 0.1 = −10% урона. */
  armor?: number;
}

export type WarriorTypeId = string;

export type WarriorTypeMap = Record<WarriorTypeId, WarriorStats>;

/** Статы героя: базовые статы воина + реген и бонус золота за убийство. */
export interface HeroStats extends WarriorStats {
  hpRegenPerSec: number;
  goldBounty: number;
}

export type HeroTypeId = string;

export type HeroTypeMap = Record<HeroTypeId, HeroStats>;
