import { Entity, EntityProps } from "../Entity";

export interface CastleProps extends Omit<EntityProps, "kind"> {
  attackRange?: number;
  attackDamage?: number;
  attackIntervalMs?: number;
}

/**
 * Главный замок игрока. Стреляет по вражеским воинам в радиусе.
 */
export class Castle extends Entity {
  public readonly attackRange: number;
  public attackDamage: number;
  public readonly attackIntervalMs: number;
  public readonly baseMaxHp: number;
  public readonly baseAttackDamage: number;
  public attackCooldownMs = 0;

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
  }
}
