import { Entity, EntityProps } from "../Entity";

export interface TowerProps extends Omit<EntityProps, "kind"> {
  attackRange: number;
  attackDamage: number;
  attackIntervalMs?: number;
}

/**
 * Оборонительная башня. Стреляет по вражеским воинам в радиусе.
 */
export class Tower extends Entity {
  public readonly attackRange: number;
  public attackDamage: number;
  public readonly attackIntervalMs: number;
  public readonly baseMaxHp: number;
  public readonly baseAttackDamage: number;
  public attackCooldownMs = 0;

  constructor(props: TowerProps) {
    super({ ...props, kind: "tower" });
    this.attackRange = props.attackRange;
    this.attackDamage = props.attackDamage;
    this.attackIntervalMs = props.attackIntervalMs ?? 500;
    this.baseMaxHp = props.maxHp;
    this.baseAttackDamage = props.attackDamage;
  }

  applyUpgrades(hpMult: number, damageMult: number): void {
    this.applyMaxHpChange(Math.round(this.baseMaxHp * hpMult));
    this.attackDamage = Math.round(this.baseAttackDamage * damageMult);
  }

  update(deltaTimeMs: number): void {
    this.attackCooldownMs = Math.max(0, this.attackCooldownMs - deltaTimeMs);
  }
}
