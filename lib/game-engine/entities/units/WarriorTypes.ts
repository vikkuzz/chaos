export interface WarriorStats {
  maxHp: number;
  speed: number; // единиц в секунду
  attackDamage: number;
  attackRange: number;
  /** Радиус обнаружения врагов. Враги в этом радиусе привлекают воина. */
  detectionRadius?: number;
  /** Интервал между атаками (мс). */
  attackIntervalMs?: number;
}

export type WarriorTypeId = string;

export type WarriorTypeMap = Record<WarriorTypeId, WarriorStats>;
