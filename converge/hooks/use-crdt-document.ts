// ============================================
// CRDT DOCUMENT HOOK
// Client-side Yjs document management
// ============================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { uint8ArrayToArray, arrayToUint8Array } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface UseCRDTDocumentOptions {
  documentId: string;
  initialState?: Uint8Array;
  onLocalUpdate?: (update: Uint8Array) => void;
}

interface CRDTDocumentState {
  text: string;
  isReady: boolean;
  clientId: number;
}

// ============================================
// HOOK
// ============================================

export function useCRDTDocument(options: UseCRDTDocumentOptions) {
  const { documentId, initialState, onLocalUpdate } = options;

  const docRef = useRef<Y.Doc | null>(null);
  const textRef = useRef<Y.Text | null>(null);
  const isLocalUpdateRef = useRef(false);

  const [state, setState] = useState<CRDTDocumentState>({
    text: "",
    isReady: false,
    clientId: 0,
  });

  // ==========================================
  // INITIALIZE DOCUMENT
  // ==========================================

  useEffect(() => {
    // Create new Yjs document
    const doc = new Y.Doc();
    const text = doc.getText("content");

    docRef.current = doc;
    textRef.current = text;

    // Apply initial state if provided
    if (initialState && initialState.length > 0) {
      Y.applyUpdate(doc, initialState);
    }

    // Set initial text content
    setState({
      text: text.toString(),
      isReady: true,
      clientId: doc.clientID,
    });

    // Listen for changes to text
    const textObserver = () => {
      setState((prev) => ({
        ...prev,
        text: text.toString(),
      }));
    };
    text.observe(textObserver);

    // Listen for all updates (to send to server)
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      // Only broadcast local updates
      if (origin === "local" || isLocalUpdateRef.current) {
        onLocalUpdate?.(update);
      }
    };
    doc.on("update", updateHandler);

    // Cleanup
    return () => {
      text.unobserve(textObserver);
      doc.off("update", updateHandler);
      doc.destroy();
      docRef.current = null;
      textRef.current = null;
    };
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================
  // REMOTE UPDATE HANDLING
  // ==========================================

  /**
   * Apply a remote update from another client
   */
  const applyRemoteUpdate = useCallback((update: Uint8Array) => {
    if (!docRef.current) return;

    // Mark as remote update so we don't broadcast it back
    isLocalUpdateRef.current = false;
    Y.applyUpdate(docRef.current, update, "remote");
  }, []);

  /**
   * Apply a full state sync from the server
   */
  const applyStateSync = useCallback((syncState: Uint8Array) => {
    if (!docRef.current) return;

    // Apply the full state
    isLocalUpdateRef.current = false;
    Y.applyUpdate(docRef.current, syncState, "sync");
  }, []);

  // ==========================================
  // LOCAL EDITING
  // ==========================================

  /**
   * Insert text at a position
   */
  const insert = useCallback((index: number, content: string) => {
    if (!textRef.current || !docRef.current) return;

    isLocalUpdateRef.current = true;
    docRef.current.transact(() => {
      textRef.current!.insert(index, content);
    }, "local");
  }, []);

  /**
   * Delete text at a position
   */
  const remove = useCallback((index: number, length: number) => {
    if (!textRef.current || !docRef.current) return;

    isLocalUpdateRef.current = true;
    docRef.current.transact(() => {
      textRef.current!.delete(index, length);
    }, "local");
  }, []);

  /**
   * Replace the entire content
   */
  const replaceAll = useCallback((content: string) => {
    if (!textRef.current || !docRef.current) return;

    isLocalUpdateRef.current = true;
    docRef.current.transact(() => {
      textRef.current!.delete(0, textRef.current!.length);
      textRef.current!.insert(0, content);
    }, "local");
  }, []);

  /**
   * Apply a diff from the editor
   * This is used when integrating with a text editor
   */
  const applyDelta = useCallback(
    (changes: { from: number; to: number; insert?: string }[]) => {
      if (!textRef.current || !docRef.current) return;

      isLocalUpdateRef.current = true;
      docRef.current.transact(() => {
        // Apply changes in reverse order to maintain correct indices
        const sortedChanges = [...changes].sort((a, b) => b.from - a.from);

        for (const change of sortedChanges) {
          if (change.from < change.to) {
            textRef.current!.delete(change.from, change.to - change.from);
          }
          if (change.insert) {
            textRef.current!.insert(change.from, change.insert);
          }
        }
      }, "local");
    },
    []
  );

  // ==========================================
  // STATE UTILITIES
  // ==========================================

  /**
   * Get the current full state
   */
  const getState = useCallback((): number[] | null => {
    if (!docRef.current) return null;
    return uint8ArrayToArray(Y.encodeStateAsUpdate(docRef.current));
  }, []);

  /**
   * Get the state vector for efficient sync
   */
  const getStateVector = useCallback((): number[] | null => {
    if (!docRef.current) return null;
    return uint8ArrayToArray(Y.encodeStateVector(docRef.current));
  }, []);

  /**
   * Get the underlying Yjs text for advanced usage
   */
  const getYText = useCallback((): Y.Text | null => {
    return textRef.current;
  }, []);

  return {
    ...state,
    applyRemoteUpdate,
    applyStateSync,
    insert,
    remove,
    replaceAll,
    applyDelta,
    getState,
    getStateVector,
    getYText,
  };
}
