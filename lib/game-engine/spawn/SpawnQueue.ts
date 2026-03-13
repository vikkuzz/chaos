import { Warrior } from "../entities/units/Warrior";

/**
 * Очередь спавна — пригодится для сложных сценариев.
 */
export class SpawnQueue {
  private queue: Warrior[] = [];

  enqueue(warrior: Warrior): void {
    this.queue.push(warrior);
  }

  drain(): Warrior[] {
    const result = this.queue;
    this.queue = [];
    return result;
  }
}
