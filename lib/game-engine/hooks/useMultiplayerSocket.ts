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
  leaveToLobby: () => void;
  connected: boolean;
  waitingForMatch: boolean;
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
  const [waitingForMatch, setWaitingForMatch] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const waitingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const s = io(socketUrl);
    socketRef.current = s;
    setSocket(s);

    const joinLobby = () => {
      const sessionId = getOrCreateSessionId();
      s.emit("lobby:join", { sessionId });
    };

    s.on("connect", () => {
      setConnected(true);
      if (!waitingRef.current) {
        joinLobby();
      }
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("lobby:assigned", (payload: { playerId: string; slot: number }) => {
      playerIdRef.current = payload.playerId;
      setPlayerId(payload.playerId);
      waitingRef.current = false;
      setWaitingForMatch(false);
    });

    s.on("lobby:state", (state: LobbyState) => {
      setLobbyState(state);
      if (!waitingRef.current) {
        setGameStarted(state.gameStarted);
      }
    });

    s.on("lobby:waiting", () => {
      waitingRef.current = true;
      setWaitingForMatch(true);
      setGameStarted(false);
      setGameState(null);
      playerIdRef.current = null;
      setPlayerId(null);
    });

    s.on("game:start", () => {
      if (!waitingRef.current) {
        setGameStarted(true);
      }
    });

    s.on("game:reset", () => {
      setGameStarted(false);
      setGameState(null);
      if (waitingRef.current || !playerIdRef.current) {
        clearSessionId();
        waitingRef.current = false;
        setWaitingForMatch(false);
        joinLobby();
      }
    });

    s.on("game:state", (snapshot: GameStateSnapshot) => {
      if (waitingRef.current) return;
      setGameState(snapshot);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      playerIdRef.current = null;
      setSocket(null);
      setPlayerId(null);
      setLobbyState(null);
      setGameStarted(false);
      setGameState(null);
      setConnected(false);
      setWaitingForMatch(false);
    };
  }, [socketUrl]);

  const setReady = useCallback(() => {
    socketRef.current?.emit("lobby:ready");
  }, []);

  const leaveToLobby = useCallback(() => {
    socketRef.current?.emit("lobby:leave");
    clearSessionId();
    playerIdRef.current = null;
    setPlayerId(null);
    setGameStarted(false);
    setGameState(null);
    waitingRef.current = true;
    setWaitingForMatch(true);
  }, []);

  return {
    socket,
    playerId,
    lobbyState,
    gameStarted,
    gameState,
    setReady,
    leaveToLobby,
    connected,
    waitingForMatch,
  };
}
