import type { WarriorStats } from "../entities/units/WarriorTypes";

export type UpgradeEffectType =
  | "hpMult"
  | "damageMult"
  | "speedMult"
  | "attackSpeedMult"
  | "detectionRadiusMult";

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
  {
    id: "plate-armor",
    name: "Латная броня",
    description: "+25% HP воинов",
    cost: 150,
    effectType: "hpMult",
    effectValue: 1.25,
    prerequisiteId: "heavy-armor",
  },
  {
    id: "impervious",
    name: "Неуязвимость",
    description: "+20% HP воинов",
    cost: 200,
    effectType: "hpMult",
    effectValue: 1.2,
    prerequisiteId: "plate-armor",
  },
  {
    id: "master-forge",
    name: "Мастерская кузница",
    description: "+30% урон воинов",
    cost: 150,
    effectType: "damageMult",
    effectValue: 1.3,
    prerequisiteId: "forge",
  },
  {
    id: "demolisher",
    name: "Разрушитель",
    description: "+25% урон воинов",
    cost: 200,
    effectType: "damageMult",
    effectValue: 1.25,
    prerequisiteId: "master-forge",
  },
  {
    id: "scout",
    name: "Следопыт",
    description: "+20% скорости воинов",
    cost: 150,
    effectType: "speedMult",
    effectValue: 1.2,
    prerequisiteId: "recon",
  },
  {
    id: "vanguard",
    name: "Авангард",
    description: "+20% скорости воинов",
    cost: 200,
    effectType: "speedMult",
    effectValue: 1.2,
    prerequisiteId: "scout",
  },
  {
    id: "combat-drill",
    name: "Боевая подготовка",
    description: "+15% скорость атак",
    cost: 50,
    effectType: "attackSpeedMult",
    effectValue: 1.15,
  },
  {
    id: "rapid-strike",
    name: "Быстрый удар",
    description: "+25% скорость атак",
    cost: 100,
    effectType: "attackSpeedMult",
    effectValue: 1.25,
    prerequisiteId: "combat-drill",
  },
  {
    id: "vigilance",
    name: "Бдительность",
    description: "+20% радиус обнаружения",
    cost: 50,
    effectType: "detectionRadiusMult",
    effectValue: 1.2,
  },
  {
    id: "sentinel",
    name: "Часовой",
    description: "+25% радиус обнаружения",
    cost: 100,
    effectType: "detectionRadiusMult",
    effectValue: 1.25,
    prerequisiteId: "vigilance",
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
export const CASTLE_BUILDING_UPGRADE_IDS = [
  "stone-walls",
  "fortress",
  "citadel",
  "tower-forge",
  "fire-arrows",
  "balista",
  "castle-artillery",
  "siege-engine",
  "crown-cannon",
] as const;

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
  {
    id: "citadel",
    name: "Цитадель",
    description: "+25% HP всех зданий",
    cost: 150,
    effectType: "buildingHpMult",
    effectValue: 1.25,
    prerequisiteId: "fortress",
  },
  {
    id: "balista",
    name: "Балиста",
    description: "+25% урон башен",
    cost: 150,
    effectType: "towerDamageMult",
    effectValue: 1.25,
    prerequisiteId: "fire-arrows",
  },
  {
    id: "siege-engine",
    name: "Осадная машина",
    description: "+25% урон замка",
    cost: 100,
    effectType: "castleDamageMult",
    effectValue: 1.25,
    prerequisiteId: "castle-artillery",
  },
  {
    id: "crown-cannon",
    name: "Королевская пушка",
    description: "+20% урон замка",
    cost: 150,
    effectType: "castleDamageMult",
    effectValue: 1.2,
    prerequisiteId: "siege-engine",
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
  {
    id: "barrack-fortify",
    name: "Укрепление II",
    description: "+20% HP барака",
    cost: 80,
    effectType: "barrackHpMult",
    effectValue: 1.2,
    prerequisiteId: "barrack-reinforce",
  },
  {
    id: "barrack-bastion",
    name: "Бастион",
    description: "+20% HP барака",
    cost: 120,
    effectType: "barrackHpMult",
    effectValue: 1.2,
    prerequisiteId: "barrack-fortify",
  },
  {
    id: "mass-recruit",
    name: "Массовый набор",
    description: "-15% время спавна",
    cost: 100,
    effectType: "barrackSpawnSpeedMult",
    effectValue: 0.85,
    prerequisiteId: "faster-recruit",
  },
  {
    id: "war-machine",
    name: "Военная машина",
    description: "-15% время спавна",
    cost: 140,
    effectType: "barrackSpawnSpeedMult",
    effectValue: 0.85,
    prerequisiteId: "mass-recruit",
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
  let attackSpeedMult = 1;
  let detectionRadiusMult = 1;

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
      case "attackSpeedMult":
        attackSpeedMult *= def.effectValue;
        break;
      case "detectionRadiusMult":
        detectionRadiusMult *= def.effectValue;
        break;
    }
  }

  const baseInterval = baseStats.attackIntervalMs ?? 400;
  const newInterval = Math.round(baseInterval / attackSpeedMult);

  const baseDetection = baseStats.detectionRadius ?? 80;
  const newDetection = Math.round(baseDetection * detectionRadiusMult);

  return {
    ...baseStats,
    maxHp: Math.round(baseStats.maxHp * hpMult),
    attackDamage: Math.round(baseStats.attackDamage * damageMult),
    speed: Math.round(baseStats.speed * speedMult),
    attackIntervalMs: newInterval,
    detectionRadius: newDetection,
  };
}
