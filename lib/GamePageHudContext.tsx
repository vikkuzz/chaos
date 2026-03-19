"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type GamePageHudPayload = {
  gold: number;
  goldPerSecond: number;
  autoDevelopmentEnabled: boolean;
  onToggleAuto: () => void;
  playerAccentColor?: string;
};

type Ctx = {
  hud: GamePageHudPayload | null;
  setHud: (value: GamePageHudPayload | null) => void;
};

const GamePageHudContext = createContext<Ctx | null>(null);

function hudEqual(
  a: GamePageHudPayload | null,
  b: GamePageHudPayload | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.gold === b.gold &&
    a.goldPerSecond === b.goldPerSecond &&
    a.autoDevelopmentEnabled === b.autoDevelopmentEnabled &&
    a.playerAccentColor === b.playerAccentColor &&
    a.onToggleAuto === b.onToggleAuto
  );
}

export function GamePageHudProvider({ children }: { children: ReactNode }) {
  const [hud, setHudState] = useState<GamePageHudPayload | null>(null);

  const setHud = useCallback((next: GamePageHudPayload | null) => {
    setHudState((prev) => (hudEqual(prev, next) ? prev : next));
  }, []);

  const value = useMemo(() => ({ hud, setHud }), [hud, setHud]);

  return (
    <GamePageHudContext.Provider value={value}>
      {children}
    </GamePageHudContext.Provider>
  );
}

export function useGamePageHud() {
  const ctx = useContext(GamePageHudContext);
  if (!ctx) throw new Error("useGamePageHud requires GamePageHudProvider");
  return ctx;
}

export function useGamePageHudWriter() {
  const ctx = useContext(GamePageHudContext);
  return ctx?.setHud;
}
