import { Barrack } from "../entities/base/Barrack";
import { Warrior } from "../entities/units/Warrior";

/**
 * Координатор спавна. Сейчас тонкая обёртка, но сюда можно
 * добавить лимиты на количество юнитов, очереди, задержки и т.д.
 */
export class SpawnManager {
  private readonly registerWarrior: (warrior: Warrior) => void;

  constructor(registerWarrior: (warrior: Warrior) => void) {
    this.registerWarrior = registerWarrior;
  }

  attachToBarrack(_barrack: Barrack): void {
    // Barrack уже вызывает onSpawnWarrior, поэтому пока ничего не делаем.
  }

  handleSpawn(warrior: Warrior): void {
    this.registerWarrior(warrior);
  }
}
