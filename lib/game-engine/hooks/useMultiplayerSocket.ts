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
  leaveSession: () => void;
  leaveAndFindGame: () => void;
  findGame: () => void;
  connected: boolean;
  hasLeft: boolean;
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

function clearSessionId(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function useMultiplayerSocket(socketUrl: string): UseMultiplayerSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);
  const [joinGeneration, setJoinGeneration] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasLeft) return;

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
      setGameStarted(state.gameStarted);
    });

    s.on("game:start", () => {
      setGameStarted(true);
    });

    s.on("game:reset", () => {
      setGameStarted(false);
      setGameState(null);
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
  }, [socketUrl, hasLeft, joinGeneration]);

  const setReady = useCallback(() => {
    socketRef.current?.emit("lobby:ready");
  }, []);

  const leaveSession = useCallback(() => {
    socketRef.current?.emit("lobby:leave");
    clearSessionId();
    setHasLeft(true);
    setGameStarted(false);
    setGameState(null);
    setLobbyState(null);
    setPlayerId(null);
    setConnected(false);
  }, []);

  const findGame = useCallback(() => {
    clearSessionId();
    setHasLeft(false);
    setJoinGeneration((n) => n + 1);
  }, []);

  const leaveAndFindGame = useCallback(() => {
    socketRef.current?.emit("lobby:leave");
    clearSessionId();
    setHasLeft(false);
    setGameStarted(false);
    setGameState(null);
    setLobbyState(null);
    setPlayerId(null);
    setJoinGeneration((n) => n + 1);
  }, []);

  return {
    socket,
    playerId,
    lobbyState,
    gameStarted,
    gameState,
    setReady,
    leaveSession,
    leaveAndFindGame,
    findGame,
    connected,
    hasLeft,
  };
}
