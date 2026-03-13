import { WarriorTypeMap } from "../entities/units/WarriorTypes";

export interface BuildingConfig {
  maxHp: number;
  radius: number;
}

export interface BarrackConfig extends BuildingConfig {
  id: string;
  spawnIntervalMs: number;
  warriorTypeId: string;
  position: { x: number; y: number };
  /**
   * Дефолтный маршрут для воинов барака.
   * Если задан, будет применён при инициализации игры.
   */
  defaultRoute?: { x: number; y: number }[];
}

export interface CastleConfig extends BuildingConfig {
  id: string;
  position: { x: number; y: number };
  attackRange?: number;
  attackDamage?: number;
  attackIntervalMs?: number;
}

export interface TowerConfig extends BuildingConfig {
  id: string;
  attackRange: number;
  attackDamage: number;
  attackIntervalMs?: number;
  position: { x: number; y: number };
}

export interface PlayerBaseConfig {
  id: string;
  color: string;
  castle: CastleConfig;
  barracks: BarrackConfig[];
  towers: TowerConfig[];
}

export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  players: PlayerBaseConfig[];
  warriorTypes: WarriorTypeMap;
}

/**
 * 4 игрока. Расстановка зданий по пользовательской конфигурации.
 */
const MAP_SIZE = 998;

const barrackDefaults = {
  maxHp: 200,
  radius: 15,
  spawnIntervalMs: 2000,
  warriorTypeId: "basic",
} as const;

const towerDefaults = {
  maxHp: 200,
  radius: 8,
  attackRange: 80,
  attackDamage: 15,
} as const;

export const defaultGameConfig: GameConfig = {
  mapWidth: MAP_SIZE,
  mapHeight: MAP_SIZE,
  warriorTypes: {
    basic: {
      maxHp: 50,
      speed: 80,
      attackDamage: 5,
      attackRange: 12,
      detectionRadius: 80,
      attackIntervalMs: 400,
    },
  },
  players: [
    {
      id: "player-1",
      color: "#ef4444",
      castle: {
        id: "p1-castle",
        maxHp: 500,
        radius: 20,
        position: { x: 500, y: 80 },
        attackRange: 120,
        attackDamage: 10,
        attackIntervalMs: 600,
      },
      barracks: [
        {
          id: "p1-barrack-1",
          ...barrackDefaults,
          position: { x: 440, y: 80 },
          defaultRoute: [
            { x: 70, y: 60 },
            { x: 70, y: 930 },
            { x: 930, y: 930 },
            { x: 930, y: 60 },
            { x: 500, y: 50 },
          ],
        },
        {
          id: "p1-barrack-2",
          ...barrackDefaults,
          position: { x: 500, y: 140 },
          defaultRoute: [
            { x: 500, y: 890 },
            { x: 70, y: 930 },
            { x: 70, y: 60 },
            { x: 930, y: 60 },
            { x: 930, y: 930 },
            { x: 500, y: 50 },
          ],
        },
        {
          id: "p1-barrack-3",
          ...barrackDefaults,
          position: { x: 560, y: 80 },
          defaultRoute: [
            { x: 930, y: 60 },
            { x: 930, y: 930 },
            { x: 70, y: 930 },
            { x: 70, y: 60 },
            { x: 500, y: 50 },
          ],
        },
      ],
      towers: [
        { id: "p1-tower-1", ...towerDefaults, position: { x: 440, y: 40 } },
        { id: "p1-tower-2", ...towerDefaults, position: { x: 440, y: 120 } },
        { id: "p1-tower-3", ...towerDefaults, position: { x: 460, y: 140 } },
        { id: "p1-tower-4", ...towerDefaults, position: { x: 540, y: 140 } },
        { id: "p1-tower-5", ...towerDefaults, position: { x: 560, y: 40 } },
        { id: "p1-tower-6", ...towerDefaults, position: { x: 560, y: 120 } },
      ],
    },
    {
      id: "player-2",
      color: "#3b82f6",
      castle: {
        id: "p2-castle",
        maxHp: 500,
        radius: 20,
        position: { x: 920, y: 480 },
        attackRange: 120,
        attackDamage: 10,
        attackIntervalMs: 600,
      },
      barracks: [
        {
          id: "p2-barrack-1",
          ...barrackDefaults,
          position: { x: 920, y: 420 },
          defaultRoute: [
            { x: 930, y: 60 },
            { x: 70, y: 60 },
            { x: 70, y: 930 },
            { x: 930, y: 930 },
            { x: 930, y: 500 },
          ],
        },
        {
          id: "p2-barrack-2",
          ...barrackDefaults,
          position: { x: 860, y: 480 },
          defaultRoute: [
            { x: 70, y: 480 },
            { x: 70, y: 60 },
            { x: 930, y: 60 },
            { x: 930, y: 930 },
            { x: 70, y: 930 },
            { x: 110, y: 480 },
            { x: 930, y: 500 },
          ],
        },
        {
          id: "p2-barrack-3",
          ...barrackDefaults,
          position: { x: 920, y: 540 },
          defaultRoute: [
            { x: 930, y: 930 },
            { x: 70, y: 930 },
            { x: 70, y: 60 },
            { x: 930, y: 60 },
            { x: 930, y: 500 },
          ],
        },
      ],
      towers: [
        { id: "p2-tower-1", ...towerDefaults, position: { x: 960, y: 420 } },
        { id: "p2-tower-2", ...towerDefaults, position: { x: 880, y: 420 } },
        { id: "p2-tower-3", ...towerDefaults, position: { x: 860, y: 440 } },
        { id: "p2-tower-4", ...towerDefaults, position: { x: 860, y: 520 } },
        { id: "p2-tower-5", ...towerDefaults, position: { x: 880, y: 540 } },
        { id: "p2-tower-6", ...towerDefaults, position: { x: 960, y: 540 } },
      ],
    },
    {
      id: "player-3",
      color: "#22c55e",
      castle: {
        id: "p3-castle",
        maxHp: 500,
        radius: 20,
        position: { x: 500, y: 920 },
        attackRange: 120,
        attackDamage: 10,
        attackIntervalMs: 600,
      },
      barracks: [
        {
          id: "p3-barrack-1",
          ...barrackDefaults,
          position: { x: 440, y: 920 },
          defaultRoute: [
            { x: 70, y: 930 },
            { x: 70, y: 60 },
            { x: 930, y: 60 },
            { x: 930, y: 930 },
            { x: 500, y: 890 },
          ],
        },
        {
          id: "p3-barrack-2",
          ...barrackDefaults,
          position: { x: 500, y: 860 },
          defaultRoute: [
            { x: 500, y: 50 },
            { x: 930, y: 60 },
            { x: 930, y: 930 },
            { x: 70, y: 930 },
            { x: 70, y: 60 },
            { x: 500, y: 100 },
            { x: 500, y: 950 },
          ],
        },
        {
          id: "p3-barrack-3",
          ...barrackDefaults,
          position: { x: 560, y: 920 },
          defaultRoute: [
            { x: 930, y: 930 },
            { x: 930, y: 60 },
            { x: 70, y: 60 },
            { x: 70, y: 930 },
            { x: 500, y: 890 },
          ],
        },
      ],
      towers: [
        { id: "p3-tower-1", ...towerDefaults, position: { x: 440, y: 960 } },
        { id: "p3-tower-2", ...towerDefaults, position: { x: 440, y: 880 } },
        { id: "p3-tower-3", ...towerDefaults, position: { x: 460, y: 860 } },
        { id: "p3-tower-4", ...towerDefaults, position: { x: 540, y: 860 } },
        { id: "p3-tower-5", ...towerDefaults, position: { x: 560, y: 880 } },
        { id: "p3-tower-6", ...towerDefaults, position: { x: 560, y: 960 } },
      ],
    },
    {
      id: "player-4",
      color: "#a855f7",
      castle: {
        id: "p4-castle",
        maxHp: 500,
        radius: 20,
        position: { x: 80, y: 480 },
        attackRange: 120,
        attackDamage: 10,
        attackIntervalMs: 600,
      },
      barracks: [
        {
          id: "p4-barrack-1",
          ...barrackDefaults,
          position: { x: 80, y: 420 },
          defaultRoute: [
            { x: 70, y: 60 },
            { x: 930, y: 60 },
            { x: 930, y: 930 },
            { x: 70, y: 930 },
            { x: 110, y: 480 },
          ],
        },
        {
          id: "p4-barrack-2",
          ...barrackDefaults,
          position: { x: 140, y: 480 },
          defaultRoute: [
            { x: 930, y: 500 },
            { x: 930, y: 930 },
            { x: 70, y: 930 },
            { x: 70, y: 60 },
            { x: 930, y: 60 },
            { x: 930, y: 480 },
            { x: 70, y: 480 },
          ],
        },
        {
          id: "p4-barrack-3",
          ...barrackDefaults,
          position: { x: 80, y: 540 },
          defaultRoute: [
            { x: 70, y: 930 },
            { x: 930, y: 930 },
            { x: 930, y: 60 },
            { x: 70, y: 60 },
            { x: 110, y: 480 },
          ],
        },
      ],
      towers: [
        { id: "p4-tower-1", ...towerDefaults, position: { x: 40, y: 420 } },
        { id: "p4-tower-2", ...towerDefaults, position: { x: 120, y: 420 } },
        { id: "p4-tower-3", ...towerDefaults, position: { x: 140, y: 520 } },
        { id: "p4-tower-4", ...towerDefaults, position: { x: 140, y: 440 } },
        { id: "p4-tower-5", ...towerDefaults, position: { x: 120, y: 540 } },
        { id: "p4-tower-6", ...towerDefaults, position: { x: 40, y: 540 } },
      ],
    },
  ],
};
