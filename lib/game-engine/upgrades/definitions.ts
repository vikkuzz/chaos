import type { WarriorStats } from "../entities/units/WarriorTypes";

export type UpgradeEffectType = "hpMult" | "damageMult" | "speedMult";

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Прирост множителя (1.2 = +20%) */
  effectType: UpgradeEffectType;
  effectValue: number;
  /** ID апгрейда, который должен быть куплен до этого */
  prerequisiteId?: string;
}

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: "armor",
    name: "Улучшенная броня",
    description: "+20% HP воинов",
    cost: 50,
    effectType: "hpMult",
    effectValue: 1.2,
  },
  {
    id: "sharp-weapon",
    name: "Острое оружие",
    description: "+25% урон воинов",
    cost: 50,
    effectType: "damageMult",
    effectValue: 1.25,
  },
  {
    id: "quick-step",
    name: "Быстрый шаг",
    description: "+15% скорости воинов",
    cost: 50,
    effectType: "speedMult",
    effectValue: 1.15,
  },
  {
    id: "heavy-armor",
    name: "Тяжёлая броня",
    description: "+30% HP воинов",
    cost: 100,
    effectType: "hpMult",
    effectValue: 1.3,
    prerequisiteId: "armor",
  },
  {
    id: "forge",
    name: "Кузница",
    description: "+35% урон воинов",
    cost: 100,
    effectType: "damageMult",
    effectValue: 1.35,
    prerequisiteId: "sharp-weapon",
  },
  {
    id: "recon",
    name: "Разведка",
    description: "+25% скорости воинов",
    cost: 100,
    effectType: "speedMult",
    effectValue: 1.25,
    prerequisiteId: "quick-step",
  },
];

export type BuildingUpgradeEffectType =
  | "buildingHpMult"
  | "towerDamageMult"
  | "castleDamageMult";

export interface BuildingUpgradeDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  effectType: BuildingUpgradeEffectType;
  effectValue: number;
  prerequisiteId?: string;
}

/** ID улучшений зданий, доступных для покупки в замке (прочность + артиллерия). */
export const CASTLE_BUILDING_UPGRADE_IDS = ["stone-walls", "fortress", "castle-artillery"] as const;

/** Глобальные улучшения зданий — покупаются в замке. */
export const BUILDING_UPGRADE_DEFINITIONS: BuildingUpgradeDefinition[] = [
  {
    id: "stone-walls",
    name: "Каменные стены",
    description: "+20% HP всех зданий",
    cost: 60,
    effectType: "buildingHpMult",
    effectValue: 1.2,
  },
  {
    id: "tower-forge",
    name: "Укреплённые башни",
    description: "+25% урон башен",
    cost: 60,
    effectType: "towerDamageMult",
    effectValue: 1.25,
  },
  {
    id: "fire-arrows",
    name: "Огненные стрелы",
    description: "+20% урон башен",
    cost: 100,
    effectType: "towerDamageMult",
    effectValue: 1.2,
    prerequisiteId: "tower-forge",
  },
  {
    id: "castle-artillery",
    name: "Артиллерия замка",
    description: "+25% урон замка",
    cost: 60,
    effectType: "castleDamageMult",
    effectValue: 1.25,
  },
  {
    id: "fortress",
    name: "Крепость",
    description: "+30% HP всех зданий",
    cost: 100,
    effectType: "buildingHpMult",
    effectValue: 1.3,
    prerequisiteId: "stone-walls",
  },
];

export type BarrackUpgradeEffectType =
  | "barrackHpMult"
  | "barrackSpawnSpeedMult"
  | "barrackSpawnCount";

export interface BarrackUpgradeDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  effectType: BarrackUpgradeEffectType;
  effectValue: number;
  prerequisiteId?: string;
}

/** Улучшения бараков — покупаются отдельно для каждого барака. */
export const BARACK_UPGRADE_DEFINITIONS: BarrackUpgradeDefinition[] = [
  {
    id: "barrack-reinforce",
    name: "Укрепление барака",
    description: "+20% HP барака",
    cost: 50,
    effectType: "barrackHpMult",
    effectValue: 1.2,
  },
  {
    id: "faster-recruit",
    name: "Ускоренный набор",
    description: "-15% время спавна",
    cost: 60,
    effectType: "barrackSpawnSpeedMult",
    effectValue: 0.85,
  },
  {
    id: "extra-recruit",
    name: "Доп. рекрут",
    description: "+1 воин за цикл спавна",
    cost: 70,
    effectType: "barrackSpawnCount",
    effectValue: 1,
  },
];

export function getBuildingUpgradeMultipliers(upgradeIds: string[]): {
  buildingHp: number;
  towerDamage: number;
  castleDamage: number;
} {
  let buildingHp = 1;
  let towerDamage = 1;
  let castleDamage = 1;
  for (const id of upgradeIds) {
    const def = BUILDING_UPGRADE_DEFINITIONS.find((d) => d.id === id);
    if (!def) continue;
    switch (def.effectType) {
      case "buildingHpMult":
        buildingHp *= def.effectValue;
        break;
      case "towerDamageMult":
        towerDamage *= def.effectValue;
        break;
      case "castleDamageMult":
        castleDamage *= def.effectValue;
        break;
    }
  }
  return { buildingHp, towerDamage, castleDamage };
}

export interface BarrackUpgradeMultipliers {
  barrackHp: number;
  spawnSpeed: number;
  spawnCount: number;
}

export function getBarrackUpgradeMultipliers(upgradeIds: string[]): BarrackUpgradeMultipliers {
  let barrackHp = 1;
  let spawnSpeed = 1;
  let spawnCount = 1;
  for (const id of upgradeIds) {
    const def = BARACK_UPGRADE_DEFINITIONS.find((d) => d.id === id);
    if (!def) continue;
    switch (def.effectType) {
      case "barrackHpMult":
        barrackHp *= def.effectValue;
        break;
      case "barrackSpawnSpeedMult":
        spawnSpeed *= def.effectValue;
        break;
      case "barrackSpawnCount":
        spawnCount += def.effectValue;
        break;
    }
  }
  return { barrackHp, spawnSpeed, spawnCount };
}

export function applyUpgradesToStats(
  baseStats: WarriorStats,
  upgradeIds: string[],
): WarriorStats {
  let hpMult = 1;
  let damageMult = 1;
  let speedMult = 1;

  for (const id of upgradeIds) {
    const def = UPGRADE_DEFINITIONS.find((d) => d.id === id);
    if (!def) continue;
    switch (def.effectType) {
      case "hpMult":
        hpMult *= def.effectValue;
        break;
      case "damageMult":
        damageMult *= def.effectValue;
        break;
      case "speedMult":
        speedMult *= def.effectValue;
        break;
    }
  }

  return {
    ...baseStats,
    maxHp: Math.round(baseStats.maxHp * hpMult),
    attackDamage: Math.round(baseStats.attackDamage * damageMult),
    speed: Math.round(baseStats.speed * speedMult),
  };
}
