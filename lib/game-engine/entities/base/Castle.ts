import { Entity, EntityProps } from "../Entity";

export interface CastleProps extends Omit<EntityProps, "kind"> {
  attackRange?: number;
  attackDamage?: number;
  attackIntervalMs?: number;
}

/** Мана замка, реген. */
export const CASTLE_SPELL = {
  MANA_MAX: 100,
  MANA_REGEN_PER_SEC: 1.5,
} as const;

/** Заклинание 1: урон в прямоугольнике 100×100. Доступно с начала. */
export const CASTLE_SPELL_1 = {
  MANA_COST: 25,
  COOLDOWN_MS: 20000,
  WIDTH: 100,
  HEIGHT: 100,
  DAMAGE: 300,
} as const;

/** Заклинание 2: убийство в радиусе. Доступно с замка 2 лвл. */
export const CASTLE_SPELL_2 = {
  MANA_COST: 50,
  COOLDOWN_MS: 60000, // 1 минута
  RADIUS: 150,
} as const;

/** Радиус взрыва при разрушении замка (область базы). */
export const CASTLE_EXPLOSION_RADIUS = 180;

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
  /** Кулдауны заклинаний (мс). */
  public spell1CooldownMs = 0;
  public spell2CooldownMs = 0;

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

  /** Здания получают на 20% меньше урона. */
  takeDamage(amount: number): void {
    super.takeDamage(Math.round(amount * 0.8));
  }

  update(deltaTimeMs: number): void {
    this.attackCooldownMs = Math.max(0, this.attackCooldownMs - deltaTimeMs);
    this.spell1CooldownMs = Math.max(0, this.spell1CooldownMs - deltaTimeMs);
    this.spell2CooldownMs = Math.max(0, this.spell2CooldownMs - deltaTimeMs);
    if (this.isAlive) {
      const regen = (CASTLE_SPELL.MANA_REGEN_PER_SEC * deltaTimeMs) / 1000;
      this.mana = Math.min(CASTLE_SPELL.MANA_MAX, this.mana + regen);
    }
  }
}
