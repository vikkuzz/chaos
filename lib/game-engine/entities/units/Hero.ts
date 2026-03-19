import { Warrior, WarriorProps } from "./Warrior";
import { HeroStats } from "./WarriorTypes";
import type { HeroTypeId } from "./WarriorTypes";

export interface HeroProps extends Omit<WarriorProps, "stats" | "baseWarriorTypeId"> {
  stats: HeroStats;
  heroTypeId: HeroTypeId;
  sourceBarrackId: string;
  /** Сохранённый уровень при повторном призыве (после смерти). */
  initialLevel?: number;
  /** Сохранённый опыт при повторном призыве. */
  initialXp?: number;
}

const XP_BASE = 50;
const XP_PER_LEVEL = 30;
const STATS_PER_LEVEL_MULT = 1.1; // +10% за уровень

/** Накопленный XP, с которого начинается уровень `level` (1-based). Для уровня 1 — 0. */
export function heroCumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return XP_BASE + (level - 1) * XP_PER_LEVEL;
}

function xpForLevel(level: number): number {
  return heroCumulativeXpForLevel(level);
}

/**
 * Герой — воин с повышенными статами, регенерацией, опытом и уровнями.
 * Движется по тому же маршруту, что и воины барака.
 */
export class Hero extends Warrior {
  public readonly heroTypeId: HeroTypeId;
  public readonly sourceBarrackId: string;
  public level = 1;
  public xp = 0;
  private readonly baseStats: HeroStats;

  constructor(props: HeroProps) {
    super({
      ...props,
      baseWarriorTypeId: props.heroTypeId,
      stats: props.stats,
    });

    this.heroTypeId = props.heroTypeId;
    this.sourceBarrackId = props.sourceBarrackId;
    this.baseStats = { ...props.stats };
    this.radius = 9; // Герои крупнее воинов
    if (props.initialLevel !== undefined && props.initialLevel > 1) {
      this.level = Math.min(20, props.initialLevel);
      this.xp = props.initialXp ?? 0;
      this.applyLevelStatsForLevel(this.level);
    }
  }

  /** Применить статы для заданного уровня (для инициализации из сохранённого прогресса). */
  private applyLevelStatsForLevel(targetLevel: number): void {
    const mult = Math.pow(STATS_PER_LEVEL_MULT, targetLevel - 1);
    const base = this.baseStats;
    (this as unknown as { stats: HeroStats }).stats = {
      ...base,
      maxHp: Math.round(base.maxHp * mult),
      attackDamage: Math.round(base.attackDamage * mult),
      speed: base.speed,
      attackRange: base.attackRange,
      detectionRadius: base.detectionRadius,
      attackIntervalMs: base.attackIntervalMs,
      hpRegenPerSec: Math.round((base.hpRegenPerSec ?? 0) * mult * 10) / 10,
      goldBounty: base.goldBounty,
    };
    this.applyMaxHpChange(this.stats.maxHp);
  }

  get isHero(): boolean {
    return true;
  }

  /** Регенерация HP в секунду. */
  get hpRegenPerSec(): number {
    return (this.stats as HeroStats).hpRegenPerSec ?? 0;
  }

  /** Золото за убийство этого героя. */
  get goldBounty(): number {
    return (this.stats as HeroStats).goldBounty ?? 25;
  }

  /** Добавить опыт, при необходимости повысить уровень. */
  gainXp(amount: number): void {
    this.xp += amount;
    while (this.level < 20 && this.xp >= xpForLevel(this.level + 1)) {
      this.level += 1;
      this.applyLevelStats();
    }
  }

  /** Пересчитать статы по текущему уровню. */
  private applyLevelStats(): void {
    this.applyLevelStatsForLevel(this.level);
  }

  override update(deltaTimeMs: number): void {
    super.update(deltaTimeMs);

    // Регенерация HP
    if (this.isAlive && this.hpRegenPerSec > 0) {
      const healAmount = (this.hpRegenPerSec * deltaTimeMs) / 1000;
      this.heal(healAmount);
    }
  }
}
