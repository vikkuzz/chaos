export type UpgradeId = string;

export interface UpgradeEffect {
  description: string;
}

export interface UpgradeDefinition {
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
  public readonly definition: UpgradeDefinition;

  constructor(definition: UpgradeDefinition) {
    this.definition = definition;
  }
}
