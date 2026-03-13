import { Upgrade, UpgradeId } from "./Upgrade";

export interface UpgradeNode {
  id: UpgradeId;
  upgrade: Upgrade;
  children: UpgradeNode[];
}

/**
 * Дерево апгрейдов (пока без логики применения).
 */
export class UpgradeTree {
  private roots: UpgradeNode[] = [];

  getRoots(): readonly UpgradeNode[] {
    return this.roots;
  }

  addRoot(node: UpgradeNode): void {
    this.roots.push(node);
  }
}
