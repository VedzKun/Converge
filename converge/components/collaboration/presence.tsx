// ============================================
// PRESENCE INDICATORS
// Online users list and cursor presence
// ============================================

"use client";

import { RoomUser, CursorPosition } from "@/types";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// ============================================
// PRESENCE BAR
// Shows all online users in the document
// ============================================

interface PresenceBarProps {
  users: RoomUser[];
  currentUserId?: string;
  className?: string;
}

export function PresenceBar({ users, currentUserId, className }: PresenceBarProps) {
  const otherUsers = users.filter((u) => u.id !== currentUserId);
  const onlineCount = otherUsers.filter((u) => u.isOnline).length;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 5).map((user) => (
          <div key={user.id} className="relative">
            <UserAvatar
              user={user}
              size="sm"
              showBorder
              className={cn(
                "transition-transform hover:scale-110 hover:z-10",
                !user.isOnline && "opacity-50"
              )}
            />
            {/* Online indicator */}
            {user.isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-gray-900" />
            )}
          </div>
        ))}
        
        {/* Overflow indicator */}
        {otherUsers.length > 5 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-xs text-gray-400 ring-2 ring-gray-900">
            +{otherUsers.length - 5}
          </div>
        )}
      </div>

      {/* Count label */}
      {onlineCount > 0 && (
        <span className="text-xs text-gray-500">
          {onlineCount} online
        </span>
      )}
    </div>
  );
}

// ============================================
// CURSOR OVERLAY
// Shows other users' cursors in the editor
// ============================================

interface CursorOverlayProps {
  cursors: Map<string, {
    position: CursorPosition;
    user: { name: string; color: string };
  }>;
  editorElement?: HTMLElement | null;
  getPositionFromOffset?: (offset: number) => { top: number; left: number } | null;
}

export function CursorOverlay({
  cursors,
  getPositionFromOffset,
}: CursorOverlayProps) {
  if (!getPositionFromOffset) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from(cursors.entries()).map(([userId, { position, user }]) => {
        const pos = getPositionFromOffset(position.head);
        if (!pos) return null;

        return (
          <div
            key={userId}
            className="absolute transition-all duration-75"
            style={{
              top: pos.top,
              left: pos.left,
            }}
          >
            {/* Cursor line */}
            <div
              className="w-0.5 h-5"
              style={{ backgroundColor: user.color }}
            />
            
            {/* Name tag */}
            <div
              className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-white shadow-lg"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// TYPING INDICATOR
// Shows when someone is typing
// ============================================

interface TypingIndicatorProps {
  typingUsers: Array<{ id: string; name: string; color: string }>;
  className?: string;
}

export function TypingIndicator({ typingUsers, className }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.name);
  let text: string;

  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else {
    text = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm text-gray-500", className)}>
      <span>{text}</span>
      <span className="inline-flex gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-gray-500" />
      </span>
    </div>
  );
}

// ============================================
// USER LIST PANEL
// Detailed list of users in the document
// ============================================

interface UserListPanelProps {
  users: RoomUser[];
  currentUserId?: string;
  className?: string;
}

export function UserListPanel({ users, currentUserId, className }: UserListPanelProps) {
  const sortedUsers = [...users].sort((a, b) => {
    // Current user first
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    // Then by online status
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    // Then by name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium text-gray-400">Collaborators</h3>
      <ul className="space-y-1">
        {sortedUsers.map((user) => (
          <li
            key={user.id}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-800/50"
          >
            <div className="relative">
              <UserAvatar user={user} size="sm" />
              {user.isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-gray-900" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">
                {user.name}
                {user.id === currentUserId && (
                  <span className="text-gray-500"> (you)</span>
                )}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
