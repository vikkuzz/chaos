"use client";

import type { GameConfig } from "../config/defaultConfig";
import type { LobbyState } from "../hooks/useMultiplayerSocket";

export interface LobbyScreenProps {
  lobbyState: LobbyState | null;
  playerId: string | null;
  config: GameConfig;
  onReady: () => void;
  connected: boolean;
}

const SLOT_LABELS = ["Игрок 1", "Игрок 2", "Игрок 3", "Игрок 4"];

export function LobbyScreen({
  lobbyState,
  playerId,
  config,
  onReady,
  connected,
}: LobbyScreenProps) {
  const playerColors = Object.fromEntries(config.players.map((p) => [p.id, p.color]));
  const players = lobbyState?.players ?? [];
  const myPlayer = players.find((p) => p.playerId === playerId);
  const isReady = myPlayer?.ready ?? false;
  const allReady =
    players.length > 0 &&
    players.every((p) => p.ready);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-6 rounded-lg border border-slate-700 bg-slate-800/80">
      <h2 className="text-xl font-semibold text-white">Лобби</h2>

      {!connected && (
        <p className="text-slate-400">Подключение к серверу...</p>
      )}

      {connected && (
        <>
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {[0, 1, 2, 3].map((slot) => {
              const p = players.find((pl) => pl.slot === slot);
              const color = p ? playerColors[p.playerId] ?? "#6b7280" : "#374151";
              const isMe = p?.playerId === playerId;
              return (
                <div
                  key={slot}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                    p ? "border-slate-600 bg-slate-700/50" : "border-slate-700 bg-slate-800/30"
                  } ${isMe ? "ring-2 ring-amber-400/50" : ""}`}
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {p ? SLOT_LABELS[slot] : "Пусто"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p?.ready ? "Готов" : "Ожидание"}
                    </div>
                  </div>
                  {isMe && (
                    <span className="text-xs text-amber-400 shrink-0">Вы</span>
                  )}
                </div>
              );
            })}
          </div>

          {!allReady && (
            <p className="text-slate-400 text-sm">Ожидание других игроков...</p>
          )}

          <button
            type="button"
            onClick={onReady}
            disabled={isReady}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              isReady
                ? "bg-emerald-600/50 text-emerald-200 cursor-default"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {isReady ? "Готов" : "Готов"}
          </button>
        </>
      )}
    </div>
  );
}
