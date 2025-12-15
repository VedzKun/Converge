// ============================================
// CONVERGE - TYPE DEFINITIONS
// Central type definitions for the entire app
// ============================================

import { Role } from "@prisma/client";

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithRole extends User {
  role: Role;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  color: string;
}

// ============================================
// AUTHENTICATION TYPES
// ============================================

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface AuthSession {
  user: SafeUser;
  token: string;
  expiresAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

// ============================================
// DOCUMENT TYPES
// ============================================

export interface Document {
  id: string;
  title: string;
  content?: Buffer | null;
  ownerId: string;
  version: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentWithOwner extends Document {
  owner: SafeUser;
}

export interface DocumentWithCollaborators extends DocumentWithOwner {
  collaborators: CollaboratorInfo[];
}

export interface CollaboratorInfo {
  id: string;
  user: SafeUser;
  role: Role;
  invitedAt: Date;
  acceptedAt?: Date | null;
}

// ============================================
// WEBSOCKET EVENT TYPES
// ============================================

export enum SocketEvent {
  // Connection events
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  ERROR = "error",

  // Room events
  JOIN_ROOM = "join_room",
  LEAVE_ROOM = "leave_room",
  ROOM_JOINED = "room_joined",
  ROOM_LEFT = "room_left",
  USER_JOINED = "user_joined",
  USER_LEFT = "user_left",

  // Collaboration events
  UPDATE_OPERATION = "update_operation",
  SYNC_STATE = "sync_state",
  REQUEST_SYNC = "request_sync",

  // Presence events
  CURSOR_PRESENCE = "cursor_presence",
  AWARENESS_UPDATE = "awareness_update",
  TYPING_INDICATOR = "typing_indicator",

  // Document events
  DOCUMENT_UPDATED = "document_updated",
  DOCUMENT_SAVED = "document_saved",
}

export interface JoinRoomPayload {
  documentId: string;
}

export interface RoomJoinedPayload {
  documentId: string;
  document: {
    id: string;
    title: string;
    version: number;
  };
  state: number[]; // Uint8Array as number array for JSON serialization
  users: RoomUser[];
  role: Role;
}

export interface RoomUser {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  role: Role;
  cursor?: CursorPosition | null;
  isOnline: boolean;
}

export interface UpdateOperationPayload {
  documentId: string;
  update: number[]; // Uint8Array as number array
  clientId: number;
  timestamp: number;
}

export interface SyncStatePayload {
  documentId: string;
  state: number[];
  version: number;
}

export interface CursorPosition {
  anchor: number;
  head: number;
}

export interface CursorPresencePayload {
  documentId: string;
  userId: string;
  cursor: CursorPosition | null;
  user: {
    name: string;
    color: string;
  };
}

export interface AwarenessState {
  cursor?: CursorPosition | null;
  user: {
    id: string;
    name: string;
    color: string;
  };
  isTyping?: boolean;
  lastActive: number;
}

export interface TypingIndicatorPayload {
  documentId: string;
  userId: string;
  isTyping: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// COLLABORATION STATE TYPES
// ============================================

export interface CollaborationState {
  documentId: string;
  isConnected: boolean;
  isSynced: boolean;
  users: Map<string, RoomUser>;
  localUser?: RoomUser;
  pendingUpdates: number;
  lastSyncTime?: Date;
}

export interface EditorState {
  content: string;
  selection: {
    anchor: number;
    head: number;
  } | null;
  isSaving: boolean;
  lastSaved?: Date;
  hasUnsavedChanges: boolean;
}

// ============================================
// REDIS TYPES (for pub/sub)
// ============================================

export interface RedisMessage {
  type: string;
  payload: unknown;
  serverId: string;
  timestamp: number;
}

export interface DocumentUpdateMessage extends RedisMessage {
  type: "document_update";
  payload: {
    documentId: string;
    update: number[];
    userId: string;
    version: number;
  };
}

export interface PresenceUpdateMessage extends RedisMessage {
  type: "presence_update";
  payload: {
    documentId: string;
    userId: string;
    presence: Partial<AwarenessState>;
  };
}

// ============================================
// PERMISSION TYPES
// ============================================

export type Permission = "read" | "write" | "delete" | "share" | "admin";

export const RolePermissions: Record<Role, Permission[]> = {
  OWNER: ["read", "write", "delete", "share", "admin"],
  EDITOR: ["read", "write"],
  VIEWER: ["read"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}

export function canEdit(role: Role): boolean {
  return hasPermission(role, "write");
}

export function canDelete(role: Role): boolean {
  return hasPermission(role, "delete");
}

export function canShare(role: Role): boolean {
  return hasPermission(role, "share");
}
