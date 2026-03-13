export type UpgradeId = string;

export interface UpgradeEffect {
  description: string;
}

export interface UpgradeSpec {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  effects: UpgradeEffect[];
}

/**
 * Описание применённого апгрейда.
 */
export class Upgrade {
  public readonly definition: UpgradeSpec;

  constructor(definition: UpgradeSpec) {
    this.definition = definition;
  }
}
