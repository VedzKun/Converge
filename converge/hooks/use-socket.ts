// ============================================
// SOCKET CLIENT HOOK
// Client-side WebSocket connection management
// ============================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  SocketEvent,
  RoomJoinedPayload,
  UpdateOperationPayload,
  CursorPresencePayload,
  RoomUser,
  CursorPosition,
} from "@/types";
import { arrayToUint8Array, uint8ArrayToArray } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface UseSocketOptions {
  documentId: string;
  token: string;
  onUpdate?: (update: Uint8Array) => void;
  onSync?: (state: Uint8Array) => void;
  onUserJoined?: (user: RoomUser) => void;
  onUserLeft?: (userId: string) => void;
  onCursorUpdate?: (userId: string, cursor: CursorPosition | null, user: { name: string; color: string }) => void;
  onSaved?: (savedAt: string) => void;
  onError?: (message: string) => void;
}

interface SocketState {
  isConnected: boolean;
  isJoined: boolean;
  users: RoomUser[];
  myRole: string | null;
  document: { id: string; title: string; version: number } | null;
}

// ============================================
// HOOK
// ============================================

export function useSocket(options: UseSocketOptions) {
  const {
    documentId,
    token,
    onUpdate,
    onSync,
    onUserJoined,
    onUserLeft,
    onCursorUpdate,
    onSaved,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    isJoined: false,
    users: [],
    myRole: null,
    document: null,
  });

  // ==========================================
  // CONNECT
  // ==========================================

  useEffect(() => {
    if (!token || !documentId) return;

    // Create socket connection
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // ========================================
    // CONNECTION EVENTS
    // ========================================

    socket.on("connect", () => {
      console.log("🔌 Connected to server");
      setState((prev) => ({ ...prev, isConnected: true }));

      // Join the document room
      socket.emit(SocketEvent.JOIN_ROOM, { documentId });
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected:", reason);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isJoined: false,
      }));
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
      onError?.(error.message);
    });

    // ========================================
    // ROOM EVENTS
    // ========================================

    socket.on(SocketEvent.ROOM_JOINED, (payload: RoomJoinedPayload) => {
      console.log("👥 Joined room:", payload.documentId);

      setState((prev) => ({
        ...prev,
        isJoined: true,
        users: payload.users,
        myRole: payload.role,
        document: payload.document,
      }));

      // Sync initial state
      if (payload.state && payload.state.length > 0) {
        onSync?.(arrayToUint8Array(payload.state));
      }
    });

    socket.on(SocketEvent.USER_JOINED, (data: { user: RoomUser }) => {
      console.log("👤 User joined:", data.user.name);

      setState((prev) => ({
        ...prev,
        users: [...prev.users.filter((u) => u.id !== data.user.id), data.user],
      }));

      onUserJoined?.(data.user);
    });

    socket.on(SocketEvent.USER_LEFT, (data: { userId: string }) => {
      console.log("👤 User left:", data.userId);

      setState((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== data.userId),
      }));

      onUserLeft?.(data.userId);
    });

    // ========================================
    // COLLABORATION EVENTS
    // ========================================

    socket.on(SocketEvent.UPDATE_OPERATION, (payload: UpdateOperationPayload) => {
      if (payload.update && payload.update.length > 0) {
        onUpdate?.(arrayToUint8Array(payload.update));
      }
    });

    socket.on(SocketEvent.SYNC_STATE, (payload: { state: number[] }) => {
      if (payload.state && payload.state.length > 0) {
        onSync?.(arrayToUint8Array(payload.state));
      }
    });

    // ========================================
    // PRESENCE EVENTS
    // ========================================

    socket.on(SocketEvent.CURSOR_PRESENCE, (payload: CursorPresencePayload) => {
      onCursorUpdate?.(payload.userId, payload.cursor, payload.user);

      // Update user's cursor in state
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === payload.userId ? { ...u, cursor: payload.cursor } : u
        ),
      }));
    });

    // ========================================
    // DOCUMENT EVENTS
    // ========================================

    socket.on(SocketEvent.DOCUMENT_SAVED, (data: { savedAt: string }) => {
      onSaved?.(data.savedAt);
    });

    socket.on(SocketEvent.ERROR, (data: { message: string }) => {
      onError?.(data.message);
    });

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      socket.emit(SocketEvent.LEAVE_ROOM);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [documentId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================
  // ACTIONS
  // ==========================================

  /**
   * Send an update to the server
   */
  const sendUpdate = useCallback((update: Uint8Array) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit(SocketEvent.UPDATE_OPERATION, {
      documentId,
      update: uint8ArrayToArray(update),
      clientId: Date.now(), // Client ID for tracking
      timestamp: Date.now(),
    });
  }, [documentId]);

  /**
   * Send cursor position
   */
  const sendCursor = useCallback((cursor: CursorPosition | null, user: { name: string; color: string }) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit(SocketEvent.CURSOR_PRESENCE, {
      documentId,
      cursor,
      user,
    });
  }, [documentId]);

  /**
   * Send typing indicator
   */
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit(SocketEvent.TYPING_INDICATOR, {
      documentId,
      isTyping,
    });
  }, [documentId]);

  /**
   * Request sync from server
   */
  const requestSync = useCallback(() => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit(SocketEvent.REQUEST_SYNC);
  }, []);

  return {
    ...state,
    sendUpdate,
    sendCursor,
    sendTyping,
    requestSync,
  };
}
