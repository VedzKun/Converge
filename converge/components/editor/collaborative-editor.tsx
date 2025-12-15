// ============================================
// COLLABORATIVE EDITOR COMPONENT
// Real-time text editor with CRDT sync
// ============================================

"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useCRDTDocument } from "@/hooks/use-crdt-document";
import { PresenceBar, TypingIndicator, UserListPanel } from "@/components/collaboration/presence";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn, debounce, throttle } from "@/lib/utils";
import { RoomUser, CursorPosition } from "@/types";
import { 
  Save, 
  Users, 
  Wifi, 
  WifiOff, 
  FileText,
  Menu,
  X
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface CollaborativeEditorProps {
  documentId: string;
  token: string;
  user: {
    id: string;
    name: string;
    color: string;
  };
  initialTitle?: string;
  readOnly?: boolean;
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function CollaborativeEditor({
  documentId,
  token,
  user,
  initialTitle = "Untitled Document",
  readOnly = false,
  className,
}: CollaborativeEditorProps) {
  // ==========================================
  // STATE
  // ==========================================

  const [title, setTitle] = useState(initialTitle);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; color: string }>>(new Map());

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ==========================================
  // CRDT DOCUMENT
  // ==========================================

  const {
    text,
    isReady: documentReady,
    applyRemoteUpdate,
    applyStateSync,
    applyDelta,
  } = useCRDTDocument({
    documentId,
    onLocalUpdate: (update) => {
      // Send update to server
      sendUpdate(update);
    },
  });

  // ==========================================
  // SOCKET CONNECTION
  // ==========================================

  const {
    isConnected,
    isJoined,
    users,
    myRole,
    sendUpdate,
    sendCursor,
    sendTyping,
  } = useSocket({
    documentId,
    token,
    onUpdate: (update) => {
      applyRemoteUpdate(update);
    },
    onSync: (state) => {
      applyStateSync(state);
    },
    onUserJoined: (newUser) => {
      console.log(`${newUser.name} joined`);
    },
    onUserLeft: (userId) => {
      // Clear typing indicator
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    },
    onSaved: (savedAt) => {
      setLastSaved(new Date(savedAt));
    },
    onError: (message) => {
      console.error("Socket error:", message);
    },
  });

  // ==========================================
  // CURSOR & TYPING HANDLERS
  // ==========================================

  // Throttled cursor update
  const handleCursorUpdate = useMemo(
    () =>
      throttle((cursor: CursorPosition) => {
        sendCursor(cursor, { name: user.name, color: user.color });
      }, 50),
    [sendCursor, user.name, user.color]
  );

  // Debounced typing indicator off
  const sendTypingOff = useMemo(
    () =>
      debounce(() => {
        sendTyping(false);
      }, 1000),
    [sendTyping]
  );

  // ==========================================
  // TEXT CHANGE HANDLER
  // ==========================================

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;

      const newValue = e.target.value;
      const oldValue = text;

      // Simple diff: find the change
      // For a production app, use a proper diff algorithm
      let start = 0;
      while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) {
        start++;
      }

      let oldEnd = oldValue.length;
      let newEnd = newValue.length;
      while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
        oldEnd--;
        newEnd--;
      }

      // Apply the change
      const deleteCount = oldEnd - start;
      const insertText = newValue.slice(start, newEnd);

      if (deleteCount > 0 || insertText.length > 0) {
        applyDelta([
          {
            from: start,
            to: start + deleteCount,
            insert: insertText,
          },
        ]);
      }

      // Send typing indicator
      sendTyping(true);
      sendTypingOff();
    },
    [text, applyDelta, sendTyping, sendTypingOff, readOnly]
  );

  // ==========================================
  // SELECTION HANDLER
  // ==========================================

  const handleSelect = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) return;

    handleCursorUpdate({
      anchor: textarea.selectionStart,
      head: textarea.selectionEnd,
    });
  }, [handleCursorUpdate]);

  // ==========================================
  // RECEIVE TYPING UPDATES
  // ==========================================

  useEffect(() => {
    // Listen for typing indicators from socket
    // This would come from the socket event handler
    // For now, we handle it through the users state
  }, []);

  // ==========================================
  // CLEANUP TYPING INDICATORS
  // ==========================================

  useEffect(() => {
    return () => {
      typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // ==========================================
  // TITLE UPDATE
  // ==========================================

  const updateTitle = useMemo(
    () =>
      debounce(async (newTitle: string) => {
        try {
          await fetch(`/api/documents/${documentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          });
        } catch (error) {
          console.error("Failed to update title:", error);
        }
      }, 1000),
    [documentId]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (myRole !== "VIEWER") {
      updateTitle(newTitle);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  const isLoading = !documentReady || !isJoined;

  return (
    <div className={cn("flex h-full flex-col bg-gray-950", className)}>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <FileText className="h-5 w-5 text-cyan-500" />
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            disabled={readOnly || myRole === "VIEWER"}
            className="bg-transparent text-lg font-medium text-white focus:outline-none focus:ring-0 disabled:opacity-50"
            placeholder="Document Title"
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs text-gray-500">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {/* Last saved */}
          {lastSaved && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Save className="h-3 w-3" />
              <span>
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* Presence */}
          <PresenceBar users={users} currentUserId={user.id} />

          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? (
              <X className="h-4 w-4" />
            ) : (
              <Users className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor area */}
        <div className="flex-1 flex flex-col relative">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Spinner size="lg" />
                <p className="text-gray-400">
                  {!documentReady ? "Loading document..." : "Connecting..."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Typing indicator */}
              <TypingIndicator
                typingUsers={Array.from(typingUsers.values()).map((u, i) => ({
                  id: String(i),
                  ...u,
                }))}
                className="absolute top-2 left-4 z-10"
              />

              {/* Text editor */}
              <textarea
                ref={editorRef}
                value={text}
                onChange={handleChange}
                onSelect={handleSelect}
                onClick={handleSelect}
                onKeyUp={handleSelect}
                disabled={readOnly || myRole === "VIEWER"}
                className={cn(
                  "flex-1 resize-none bg-transparent p-6 font-mono text-gray-100 focus:outline-none",
                  "scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700",
                  (readOnly || myRole === "VIEWER") && "cursor-default"
                )}
                placeholder={
                  readOnly || myRole === "VIEWER"
                    ? "You have read-only access to this document"
                    : "Start typing..."
                }
                spellCheck={false}
              />

              {/* Role indicator */}
              {myRole === "VIEWER" && (
                <div className="absolute bottom-4 left-4 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-sm text-yellow-500">
                  Read-only mode
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-64 border-l border-gray-800 bg-gray-900/50 p-4">
            <UserListPanel users={users} currentUserId={user.id} />
          </aside>
        )}
      </div>
    </div>
  );
}
