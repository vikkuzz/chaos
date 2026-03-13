"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Game } from "../core/Game";
import type { GameStateSnapshot } from "../core/Game";

export interface GameContextValue {
  game: Game | null;
  state: GameStateSnapshot | null;
  setBarrackRoute: (barrackId: string, waypoints: { x: number; y: number }[]) => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export interface GameProviderProps {
  value: GameContextValue;
  children: ReactNode;
}

/**
 * Провайдер, который позволяет пробрасывать Game/состояние в любое место React-дерева.
 */
export function GameProvider({ value, children }: GameProviderProps) {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGameContext должен вызываться внутри GameProvider.");
  }
  return ctx;
}
