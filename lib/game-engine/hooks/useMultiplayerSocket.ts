"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { GameStateSnapshot } from "../core/Game";

export interface LobbyPlayer {
  playerId: string;
  slot: number;
  ready: boolean;
}

export interface LobbyState {
  players: LobbyPlayer[];
  gameStarted: boolean;
}

export interface UseMultiplayerSocketResult {
  socket: Socket | null;
  playerId: string | null;
  lobbyState: LobbyState | null;
  gameStarted: boolean;
  gameState: GameStateSnapshot | null;
  setReady: () => void;
  connected: boolean;
}

const SESSION_STORAGE_KEY = "rts-session-id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

export function useMultiplayerSocket(socketUrl: string): UseMultiplayerSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const s = io(socketUrl);
    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      const sessionId = getOrCreateSessionId();
      s.emit("lobby:join", { sessionId });
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("lobby:assigned", (payload: { playerId: string; slot: number }) => {
      setPlayerId(payload.playerId);
    });

    s.on("lobby:state", (state: LobbyState) => {
      setLobbyState(state);
      if (state.gameStarted) {
        setGameStarted(true);
      }
    });

    s.on("game:start", () => {
      setGameStarted(true);
    });

    s.on("game:state", (snapshot: GameStateSnapshot) => {
      setGameState(snapshot);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setPlayerId(null);
      setLobbyState(null);
      setGameStarted(false);
      setGameState(null);
      setConnected(false);
    };
  }, [socketUrl]);

  const setReady = useCallback(() => {
    socketRef.current?.emit("lobby:ready");
  }, []);

  return {
    socket,
    playerId,
    lobbyState,
    gameStarted,
    gameState,
    setReady,
    connected,
  };
}
