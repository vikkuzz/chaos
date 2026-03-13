import { Entity, EntityProps } from "../Entity";

export interface BaseProps extends Omit<EntityProps, "kind"> {}

/**
 * Логический «холдер» базы игрока. Сейчас почти пустой, но пригодится для экономики/ресурсов.
 */
export class Base extends Entity {
  constructor(props: BaseProps) {
    super({ ...props, kind: "base" });
  }

  update(_deltaTimeMs: number): void {
    // Здесь можно реализовать экономику, добычу ресурсов и т.п.
  }
}
