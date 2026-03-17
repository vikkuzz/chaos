import { Entity, EntityProps } from "../Entity";

export interface CastleProps extends Omit<EntityProps, "kind"> {
  attackRange?: number;
  attackDamage?: number;
  attackIntervalMs?: number;
}

/** Мана замка, реген, стоимость заклинания, радиус, кулдаун. */
export const CASTLE_SPELL = {
  MANA_MAX: 100,
  MANA_REGEN_PER_SEC: 1.5,
  SPELL_COST: 50,
  SPELL_RADIUS: 140,
  SPELL_COOLDOWN_MS: 12000,
} as const;

/**
 * Главный замок игрока. Стреляет по вражеским воинам в радиусе.
 * Имеет ману и заклинание для убийства врагов в пределах базы.
 */
export class Castle extends Entity {
  public readonly attackRange: number;
  public attackDamage: number;
  public readonly attackIntervalMs: number;
  public readonly baseMaxHp: number;
  public readonly baseAttackDamage: number;
  public attackCooldownMs = 0;

  /** Текущая мана замка. */
  public mana: number = CASTLE_SPELL.MANA_MAX;
  /** Оставшийся кулдаун заклинания (мс). */
  public spellCooldownMs = 0;

  constructor(props: CastleProps) {
    super({ ...props, kind: "castle" });
    this.attackRange = props.attackRange ?? 0;
    this.attackDamage = props.attackDamage ?? 0;
    this.attackIntervalMs = props.attackIntervalMs ?? 600;
    this.baseMaxHp = props.maxHp;
    this.baseAttackDamage = props.attackDamage ?? 0;
  }

  applyUpgrades(hpMult: number, damageMult: number): void {
    this.applyMaxHpChange(Math.round(this.baseMaxHp * hpMult));
    this.attackDamage = Math.round(this.baseAttackDamage * damageMult);
  }

  update(deltaTimeMs: number): void {
    this.attackCooldownMs = Math.max(0, this.attackCooldownMs - deltaTimeMs);
    this.spellCooldownMs = Math.max(0, this.spellCooldownMs - deltaTimeMs);
    if (this.isAlive) {
      const regen = (CASTLE_SPELL.MANA_REGEN_PER_SEC * deltaTimeMs) / 1000;
      this.mana = Math.min(CASTLE_SPELL.MANA_MAX, this.mana + regen);
    }
  }
}
