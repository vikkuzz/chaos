"use client";

import { GameCanvas } from "@/lib/game-engine/renderer/GameCanvas";
import { defaultGameConfig } from "@/lib/game-engine";

export default function GamePage() {
  return (
    <main className="min-h-screen min-h-dvh flex flex-col md:items-center md:justify-center bg-slate-900 p-2 sm:p-4">
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 max-w-[1280px] w-full md:h-[min(900px,calc(100vh-2rem))] h-[calc(100dvh-1rem)] md:min-h-[500px] min-h-[400px] mx-auto">
        <div className="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-700">
          <GameCanvas config={defaultGameConfig} />
        </div>
      </div>
    </main>
  );
}
