// ============================================
// SOCKET.IO SERVER IMPLEMENTATION
// Real-time WebSocket server for collaboration
// ============================================

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyToken } from "@/lib/auth/utils";
import { checkDocumentAccess } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { documentStore, CRDTDocument } from "@/lib/crdt/document";
import { arrayToUint8Array, uint8ArrayToArray } from "@/lib/utils";
import {
  SocketEvent,
  JoinRoomPayload,
  RoomJoinedPayload,
  RoomUser,
  UpdateOperationPayload,
  CursorPresencePayload,
  TypingIndicatorPayload,
  SafeUser,
} from "@/types";
import { Role } from "@prisma/client";

// ============================================
// TYPES
// ============================================

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: SafeUser;
}

interface RoomState {
  documentId: string;
  users: Map<string, RoomUser>;
  document: CRDTDocument;
  lastSaveTime: number;
  saveTimeout?: ReturnType<typeof setTimeout>;
}

// ============================================
// SOCKET SERVER CLASS
// ============================================

export class CollaborationServer {
  private io: SocketIOServer;
  private rooms: Map<string, RoomState> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private socketToRoom: Map<string, string> = new Map(); // socketId -> roomId

  // Debounce settings for auto-save
  private readonly SAVE_DEBOUNCE_MS = 2000;
  private readonly SNAPSHOT_INTERVAL_MS = 60000; // 1 minute

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      // Connection settings for reliability
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ["websocket", "polling"],
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    console.log("✅ Collaboration server initialized");
  }

  // ============================================
  // MIDDLEWARE
  // ============================================

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        // Extract token from auth object or query
        const token =
          socket.handshake.auth?.token ||
          (socket.handshake.query?.token as string);

        if (!token) {
          return next(new Error("Authentication required"));
        }

        // Verify JWT token
        const payload = verifyToken(token);
        if (!payload) {
          return next(new Error("Invalid or expired token"));
        }

        // Fetch user from database to ensure they still exist
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            color: true,
          },
        });

        if (!user) {
          return next(new Error("User not found"));
        }

        // Attach user to socket
        socket.userId = user.id;
        socket.user = user;

        next();
      } catch (error) {
        console.error("Socket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private setupEventHandlers(): void {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`🔌 Client connected: ${socket.id} (User: ${socket.user?.name})`);

      // Track user's sockets for multi-tab support
      this.trackUserSocket(socket.userId!, socket.id);

      // ==========================================
      // JOIN ROOM
      // ==========================================
      socket.on(SocketEvent.JOIN_ROOM, async (payload: JoinRoomPayload) => {
        await this.handleJoinRoom(socket, payload);
      });

      // ==========================================
      // LEAVE ROOM
      // ==========================================
      socket.on(SocketEvent.LEAVE_ROOM, async () => {
        await this.handleLeaveRoom(socket);
      });

      // ==========================================
      // UPDATE OPERATION (CRDT)
      // ==========================================
      socket.on(
        SocketEvent.UPDATE_OPERATION,
        async (payload: UpdateOperationPayload) => {
          await this.handleUpdateOperation(socket, payload);
        }
      );

      // ==========================================
      // CURSOR PRESENCE
      // ==========================================
      socket.on(
        SocketEvent.CURSOR_PRESENCE,
        (payload: CursorPresencePayload) => {
          this.handleCursorPresence(socket, payload);
        }
      );

      // ==========================================
      // TYPING INDICATOR
      // ==========================================
      socket.on(
        SocketEvent.TYPING_INDICATOR,
        (payload: TypingIndicatorPayload) => {
          this.handleTypingIndicator(socket, payload);
        }
      );

      // ==========================================
      // REQUEST SYNC (for reconnection)
      // ==========================================
      socket.on(SocketEvent.REQUEST_SYNC, async () => {
        await this.handleRequestSync(socket);
      });

      // ==========================================
      // DISCONNECT
      // ==========================================
      socket.on("disconnect", async (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id} (Reason: ${reason})`);
        await this.handleDisconnect(socket);
      });
    });
  }

  // ============================================
  // ROOM MANAGEMENT
  // ============================================

  private async handleJoinRoom(
    socket: AuthenticatedSocket,
    payload: JoinRoomPayload
  ): Promise<void> {
    const { documentId } = payload;
    const userId = socket.userId!;
    const user = socket.user!;

    try {
      // Check document access
      const { hasAccess, role } = await checkDocumentAccess(userId, documentId);

      if (!hasAccess || !role) {
        socket.emit(SocketEvent.ERROR, {
          message: "Access denied to this document",
        });
        return;
      }

      // Leave any existing room
      await this.handleLeaveRoom(socket);

      // Join the Socket.IO room
      const roomId = `doc:${documentId}`;
      socket.join(roomId);
      this.socketToRoom.set(socket.id, roomId);

      // Get or create room state
      let roomState = this.rooms.get(roomId);

      if (!roomState) {
        // Load document from database
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          select: { id: true, title: true, content: true, version: true },
        });

        if (!document) {
          socket.emit(SocketEvent.ERROR, { message: "Document not found" });
          return;
        }

        // Create CRDT document with initial state
        const initialState = document.content
          ? new Uint8Array(document.content)
          : undefined;
        const crdtDoc = documentStore.getOrCreate(documentId, initialState);

        roomState = {
          documentId,
          users: new Map(),
          document: crdtDoc,
          lastSaveTime: Date.now(),
        };

        this.rooms.set(roomId, roomState);
      }

      // Add user to room
      const roomUser: RoomUser = {
        id: userId,
        name: user.name,
        color: user.color,
        avatar: user.avatar,
        role,
        cursor: null,
        isOnline: true,
      };
      roomState.users.set(userId, roomUser);

      // Get document info
      const documentInfo = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, title: true, version: true },
      });

      // Send room joined event with document state
      const joinedPayload: RoomJoinedPayload = {
        documentId,
        document: {
          id: documentInfo!.id,
          title: documentInfo!.title,
          version: documentInfo!.version,
        },
        state: roomState.document.getStateArray(),
        users: Array.from(roomState.users.values()),
        role,
      };

      socket.emit(SocketEvent.ROOM_JOINED, joinedPayload);

      // Notify others in the room
      socket.to(roomId).emit(SocketEvent.USER_JOINED, {
        user: roomUser,
      });

      console.log(`👥 User ${user.name} joined room ${roomId} as ${role}`);
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit(SocketEvent.ERROR, {
        message: "Failed to join room",
      });
    }
  }

  private async handleLeaveRoom(socket: AuthenticatedSocket): Promise<void> {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const roomState = this.rooms.get(roomId);
    if (!roomState) return;

    const userId = socket.userId!;

    // Check if user has other sockets in this room
    const userSockets = this.userSockets.get(userId);
    const userSocketsInRoom = userSockets
      ? Array.from(userSockets).filter((sid) => {
          return this.socketToRoom.get(sid) === roomId && sid !== socket.id;
        })
      : [];

    // Only remove user if this is their last socket in the room
    if (userSocketsInRoom.length === 0) {
      roomState.users.delete(userId);

      // Notify others
      socket.to(roomId).emit(SocketEvent.USER_LEFT, {
        userId,
      });
    }

    // Leave the room
    socket.leave(roomId);
    this.socketToRoom.delete(socket.id);

    // Clean up empty rooms
    if (roomState.users.size === 0) {
      // Save document before cleaning up
      await this.saveDocument(roomState);

      // Clear save timeout
      if (roomState.saveTimeout) {
        clearTimeout(roomState.saveTimeout);
      }

      // Remove from stores
      documentStore.remove(roomState.documentId);
      this.rooms.delete(roomId);

      console.log(`🏠 Room ${roomId} cleaned up (no users)`);
    }
  }

  // ============================================
  // CRDT OPERATIONS
  // ============================================

  private async handleUpdateOperation(
    socket: AuthenticatedSocket,
    payload: UpdateOperationPayload
  ): Promise<void> {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const roomState = this.rooms.get(roomId);
    if (!roomState) return;

    const userId = socket.userId!;
    const userRole = roomState.users.get(userId)?.role;

    // Check write permission
    if (userRole === Role.VIEWER) {
      socket.emit(SocketEvent.ERROR, {
        message: "You do not have permission to edit this document",
      });
      return;
    }

    try {
      // Apply the update to our CRDT document
      const update = arrayToUint8Array(payload.update);
      roomState.document.applyUpdate(update);

      // Broadcast to all other clients in the room
      socket.to(roomId).emit(SocketEvent.UPDATE_OPERATION, {
        documentId: payload.documentId,
        update: payload.update,
        clientId: payload.clientId,
        timestamp: payload.timestamp,
        userId,
      });

      // Schedule auto-save with debouncing
      this.scheduleSave(roomState);
    } catch (error) {
      console.error("Error applying update:", error);
      socket.emit(SocketEvent.ERROR, {
        message: "Failed to apply update",
      });
    }
  }

  private async handleRequestSync(socket: AuthenticatedSocket): Promise<void> {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const roomState = this.rooms.get(roomId);
    if (!roomState) return;

    // Send current state
    socket.emit(SocketEvent.SYNC_STATE, {
      documentId: roomState.documentId,
      state: roomState.document.getStateArray(),
      version: await this.getDocumentVersion(roomState.documentId),
    });
  }

  // ============================================
  // PRESENCE
  // ============================================

  private handleCursorPresence(
    socket: AuthenticatedSocket,
    payload: CursorPresencePayload
  ): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const roomState = this.rooms.get(roomId);
    if (!roomState) return;

    const userId = socket.userId!;
    const roomUser = roomState.users.get(userId);

    if (roomUser) {
      roomUser.cursor = payload.cursor;
    }

    // Broadcast to others (throttled on client side)
    socket.to(roomId).emit(SocketEvent.CURSOR_PRESENCE, {
      ...payload,
      userId,
    });
  }

  private handleTypingIndicator(
    socket: AuthenticatedSocket,
    payload: TypingIndicatorPayload
  ): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    // Broadcast to others
    socket.to(roomId).emit(SocketEvent.TYPING_INDICATOR, {
      ...payload,
      userId: socket.userId,
    });
  }

  // ============================================
  // DISCONNECT HANDLING
  // ============================================

  private async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    // Remove socket from user tracking
    this.untrackUserSocket(socket.userId!, socket.id);

    // Leave any room
    await this.handleLeaveRoom(socket);
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private scheduleSave(roomState: RoomState): void {
    // Clear existing timeout
    if (roomState.saveTimeout) {
      clearTimeout(roomState.saveTimeout);
    }

    // Schedule new save
    roomState.saveTimeout = setTimeout(async () => {
      await this.saveDocument(roomState);
    }, this.SAVE_DEBOUNCE_MS);
  }

  private async saveDocument(roomState: RoomState): Promise<void> {
    try {
      const state = roomState.document.getState();
      const now = Date.now();

      // Update document in database
      await prisma.document.update({
        where: { id: roomState.documentId },
        data: {
          content: Buffer.from(state),
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      // Create operation log entry
      await prisma.operation.create({
        data: {
          documentId: roomState.documentId,
          userId: "system", // Could track which user triggered the save
          data: Buffer.from(state),
          version: await this.getDocumentVersion(roomState.documentId),
        },
      });

      // Create snapshot if enough time has passed
      if (now - roomState.lastSaveTime > this.SNAPSHOT_INTERVAL_MS) {
        await prisma.snapshot.create({
          data: {
            documentId: roomState.documentId,
            data: Buffer.from(state),
            version: await this.getDocumentVersion(roomState.documentId),
          },
        });
      }

      roomState.lastSaveTime = now;

      // Notify room that document was saved
      this.io.to(`doc:${roomState.documentId}`).emit(SocketEvent.DOCUMENT_SAVED, {
        documentId: roomState.documentId,
        savedAt: new Date().toISOString(),
      });

      console.log(`💾 Document ${roomState.documentId} saved`);
    } catch (error) {
      console.error("Error saving document:", error);
    }
  }

  private async getDocumentVersion(documentId: string): Promise<number> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { version: true },
    });
    return doc?.version ?? 0;
  }

  // ============================================
  // USER SOCKET TRACKING
  // ============================================

  private trackUserSocket(userId: string, socketId: string): void {
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socketId);
  }

  private untrackUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get the Socket.IO server instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Get all active rooms
   */
  getActiveRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get users in a room
   */
  getRoomUsers(documentId: string): RoomUser[] {
    const roomState = this.rooms.get(`doc:${documentId}`);
    return roomState ? Array.from(roomState.users.values()) : [];
  }

  /**
   * Broadcast a message to a room
   */
  broadcastToRoom(documentId: string, event: string, data: unknown): void {
    this.io.to(`doc:${documentId}`).emit(event, data);
  }

  /**
   * Force save all documents (for graceful shutdown)
   */
  async saveAllDocuments(): Promise<void> {
    console.log("💾 Saving all active documents...");
    const savePromises = Array.from(this.rooms.values()).map((roomState) =>
      this.saveDocument(roomState)
    );
    await Promise.all(savePromises);
    console.log("✅ All documents saved");
  }

  /**
   * Shutdown the server gracefully
   */
  async shutdown(): Promise<void> {
    await this.saveAllDocuments();
    this.io.close();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let collaborationServer: CollaborationServer | null = null;

export function initializeCollaborationServer(
  httpServer: HTTPServer
): CollaborationServer {
  if (!collaborationServer) {
    collaborationServer = new CollaborationServer(httpServer);
  }
  return collaborationServer;
}

export function getCollaborationServer(): CollaborationServer | null {
  return collaborationServer;
}
