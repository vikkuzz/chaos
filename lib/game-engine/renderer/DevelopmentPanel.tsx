"use client";

import type { PlayerState } from "../core/Game";
import type { GameConfig } from "../config/defaultConfig";

export interface DevelopmentPanelProps {
  config: GameConfig;
  playerStates: Record<string, PlayerState>;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  gameOver?: boolean;
  fogOfWarEnabled?: boolean;
  onToggleFogOfWar?: () => void;
}

export function DevelopmentPanel({
  config,
  playerStates,
  selectedPlayerId,
  onSelectPlayer,
  gameOver,
  fogOfWarEnabled = true,
  onToggleFogOfWar,
}: DevelopmentPanelProps) {
  const ps = selectedPlayerId ? playerStates[selectedPlayerId] : null;

  return (
    <div className="hidden md:flex min-h-0 max-h-full flex-shrink-0 flex-col gap-3 overflow-y-auto rounded-lg bg-slate-800/95 p-2 sm:p-3 text-xs sm:text-sm w-full md:w-[240px]">
      <h3 className="font-semibold text-amber-400">Развитие</h3>

      {onToggleFogOfWar && (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={fogOfWarEnabled}
            onChange={() => onToggleFogOfWar?.()}
            className="rounded"
          />
          <span className="text-slate-300">Туман войны</span>
        </label>
      )}

      <div>
        <span className="text-slate-500">Игрок:</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {config.players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPlayer(p.id)}
              disabled={gameOver}
              className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                selectedPlayerId === p.id
                  ? "ring-1 ring-amber-500 ring-offset-1 ring-offset-slate-800"
                  : "hover:bg-slate-700"
              }`}
              style={
                selectedPlayerId === p.id
                  ? { backgroundColor: p.color, color: "#1e293b" }
                  : { borderLeft: `3px solid ${p.color}` }
              }
            >
              {p.id.replace("player-", "П")}
            </button>
          ))}
        </div>
      </div>

      {selectedPlayerId && ps && (
        <>
          <div className="flex flex-col gap-0.5 rounded bg-slate-700/80 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-amber-300">🪙</span>
              <span className="font-mono font-semibold tabular-nums">
                {Math.floor(ps.gold)}
              </span>
              <span className="text-slate-500">золота</span>
            </div>
            {(ps.goldPerSecond ?? 0) > 0 && (
              <span className="tabular-nums text-slate-400 text-[10px]">
                +{(ps.goldPerSecond ?? 0).toFixed(1)} золота/сек
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Кликните по замку или бараку на карте для улучшений
          </p>
        </>
      )}
    </div>
  );
}
