"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GameCanvas } from "@/lib/game-engine/renderer/GameCanvas";
import { LobbyScreen } from "@/lib/game-engine/components/LobbyScreen";
import { useMultiplayerSocket } from "@/lib/game-engine/hooks/useMultiplayerSocket";
import { defaultGameConfig } from "@/lib/game-engine";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

function MultiplayerGame() {
  const {
    socket,
    playerId,
    lobbyState,
    gameStarted,
    gameState,
    setReady,
    connected,
  } = useMultiplayerSocket(SOCKET_URL);

  return (
    <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-700">
      {!gameStarted ? (
        <LobbyScreen
          lobbyState={lobbyState}
          playerId={playerId}
          config={defaultGameConfig}
          onReady={setReady}
          connected={connected}
        />
      ) : (
        <GameCanvas
          config={defaultGameConfig}
          mode="multiplayer"
          socketUrl={SOCKET_URL}
          multiplayerSocket={socket ?? undefined}
          multiplayerPlayerId={playerId}
          multiplayerGameState={gameState}
        />
      )}
    </div>
  );
}

function GameContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "multiplayer" ? "multiplayer" : "local";

  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-3 max-w-[1280px] w-full md:h-[min(900px,calc(100vh-2rem))] h-[calc(100dvh-1rem)] md:min-h-[500px] min-h-[400px] mx-auto">
      {mode === "multiplayer" ? (
        <MultiplayerGame />
      ) : (
        <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-700">
          <GameCanvas config={defaultGameConfig} mode="local" />
        </div>
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <main className="min-h-screen min-h-dvh flex flex-col md:items-center md:justify-center bg-slate-900 p-2 sm:p-4">
      <Suspense fallback={<div className="text-white">Загрузка...</div>}>
        <GameContent />
      </Suspense>
    </main>
  );
}
