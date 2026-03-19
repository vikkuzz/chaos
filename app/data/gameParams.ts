import { DEFAULT_BARRACK_MAX_HP } from "@/lib/game-engine/config/defaultConfig";

/**
 * Статические параметры игры для отображения на главной странице.
 * Синхронизированы с defaultGameConfig.
 */
export const gameParams = {
  mapSize: 998,
  playersCount: 4,
  warriorTypes: {
    basic: {
      name: "Пехотинец",
      maxHp: 84,
      speed: 56,
      attackDamage: 5,
      attackRange: 12,
      detectionRadius: 80,
      attackIntervalMs: 480,
    },
    archer: {
      name: "Лучник",
      maxHp: 58,
      speed: 49,
      attackDamage: 4,
      attackRange: 45,
      detectionRadius: 90,
      attackIntervalMs: 600,
    },
  },
  heroTypes: {
    "hero-1": {
      name: "Герой 1",
      maxHp: 1500,
      speed: 75,
      attackDamage: 20,
      attackRange: 14,
      hpRegenPerSec: 2,
      goldBounty: 300,
    },
    "hero-2": {
      name: "Герой 2",
      maxHp: 1500,
      speed: 80,
      attackDamage: 24,
      attackRange: 12,
      hpRegenPerSec: 1.5,
      goldBounty: 300,
    },
    "hero-3": {
      name: "Герой 3",
      maxHp: 1500,
      speed: 65,
      attackDamage: 16,
      attackRange: 15,
      hpRegenPerSec: 3,
      goldBounty: 300,
    },
  },
  buildings: {
    castle: {
      name: "Замок",
      maxHp: 1002,
      radius: 20,
      attackRange: 120,
      attackDamage: 32,
      attackIntervalMs: 720,
    },
    barrack: {
      name: "Барак",
      maxHp: DEFAULT_BARRACK_MAX_HP,
      radius: 15,
      spawnIntervalMs: 15000,
      attackRange: 80,
      attackDamage: 38,
      attackIntervalMs: 600,
    },
    tower: {
      name: "Башня",
      maxHp: 401,
      radius: 8,
      attackRange: 80,
      attackDamage: 38,
      attackIntervalMs: 600,
    },
  },
  neutralPoints: {
    count: 8,
    goldPerInterval: 2,
    goldIntervalMs: 5000,
    captureRadius: 80,
  },
} as const;
