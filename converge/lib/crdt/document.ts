// ============================================
// CRDT DOCUMENT MANAGER
// Yjs-based CRDT implementation for real-time collaboration
// 
// WHY YJS (CRDT) OVER OPERATIONAL TRANSFORMATION?
// ================================================
// 1. No central server required for conflict resolution
//    - OT requires a central server to order and transform operations
//    - CRDTs resolve conflicts mathematically at each node
//
// 2. Offline support
//    - Users can edit offline; changes merge when reconnected
//    - OT struggles with offline edits and long disconnections
//
// 3. Eventual consistency guaranteed
//    - Mathematical proof that all replicas converge
//    - No edge cases where documents diverge
//
// 4. Simpler implementation
//    - No complex transformation functions
//    - No operation ordering logic
//
// 5. Better scalability
//    - No bottleneck at central transformation server
//    - Each node can process updates independently
// ============================================

import * as Y from "yjs";
import { uint8ArrayToArray, arrayToUint8Array } from "@/lib/utils";

// ============================================
// DOCUMENT MANAGER CLASS
// ============================================

export class CRDTDocument {
  private doc: Y.Doc;
  private content: Y.Text;
  private documentId: string;

  constructor(documentId: string, initialState?: Uint8Array) {
    this.documentId = documentId;
    this.doc = new Y.Doc();

    // The main text content - Yjs automatically handles all CRDT logic
    this.content = this.doc.getText("content");

    // Apply initial state if provided
    if (initialState && initialState.length > 0) {
      Y.applyUpdate(this.doc, initialState);
    }
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  /**
   * Get the full document state as a Uint8Array
   * This is the complete state that can be used to reconstruct the document
   */
  getState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /**
   * Get state as number array for JSON serialization
   */
  getStateArray(): number[] {
    return uint8ArrayToArray(this.getState());
  }

  /**
   * Get the state vector (for efficient sync)
   * The state vector tracks which updates each client has seen
   */
  getStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc);
  }

  /**
   * Apply an update from another client
   * Yjs handles all conflict resolution automatically
   */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
  }

  /**
   * Apply update from number array (received from WebSocket)
   */
  applyUpdateArray(update: number[]): void {
    this.applyUpdate(arrayToUint8Array(update));
  }

  /**
   * Get updates that the other client doesn't have
   * Used for efficient synchronization
   */
  getUpdatesSince(stateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, stateVector);
  }

  // ============================================
  // CONTENT OPERATIONS
  // ============================================

  /**
   * Get the current text content
   */
  getText(): string {
    return this.content.toString();
  }

  /**
   * Insert text at a position
   */
  insert(index: number, text: string): Uint8Array {
    this.doc.transact(() => {
      this.content.insert(index, text);
    });
    return this.getState();
  }

  /**
   * Delete text at a position
   */
  delete(index: number, length: number): Uint8Array {
    this.doc.transact(() => {
      this.content.delete(index, length);
    });
    return this.getState();
  }

  /**
   * Replace all content
   */
  replaceAll(text: string): Uint8Array {
    this.doc.transact(() => {
      this.content.delete(0, this.content.length);
      this.content.insert(0, text);
    });
    return this.getState();
  }

  // ============================================
  // EVENT HANDLING
  // ============================================

  /**
   * Subscribe to document updates
   * Callback receives the binary update that can be sent to other clients
   */
  onUpdate(callback: (update: Uint8Array, origin: unknown) => void): void {
    this.doc.on("update", callback);
  }

  /**
   * Unsubscribe from updates
   */
  offUpdate(callback: (update: Uint8Array, origin: unknown) => void): void {
    this.doc.off("update", callback);
  }

  /**
   * Subscribe to text changes
   */
  onTextChange(callback: (event: Y.YTextEvent) => void): void {
    this.content.observe(callback);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get the Yjs client ID (unique per document instance)
   */
  getClientId(): number {
    return this.doc.clientID;
  }

  /**
   * Get the document ID
   */
  getDocumentId(): string {
    return this.documentId;
  }

  /**
   * Get the underlying Yjs doc (for advanced usage)
   */
  getYDoc(): Y.Doc {
    return this.doc;
  }

  /**
   * Get the underlying Yjs text (for advanced usage)
   */
  getYText(): Y.Text {
    return this.content;
  }

  /**
   * Destroy the document and clean up
   */
  destroy(): void {
    this.doc.destroy();
  }
}

// ============================================
// DOCUMENT STORE
// Server-side store for active documents
// ============================================

export class DocumentStore {
  private documents: Map<string, CRDTDocument> = new Map();

  /**
   * Get or create a document
   */
  getOrCreate(documentId: string, initialState?: Uint8Array): CRDTDocument {
    let doc = this.documents.get(documentId);

    if (!doc) {
      doc = new CRDTDocument(documentId, initialState);
      this.documents.set(documentId, doc);
    }

    return doc;
  }

  /**
   * Get a document if it exists
   */
  get(documentId: string): CRDTDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Check if a document exists in the store
   */
  has(documentId: string): boolean {
    return this.documents.has(documentId);
  }

  /**
   * Remove a document from the store
   */
  remove(documentId: string): void {
    const doc = this.documents.get(documentId);
    if (doc) {
      doc.destroy();
      this.documents.delete(documentId);
    }
  }

  /**
   * Get all document IDs
   */
  getDocumentIds(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get count of active documents
   */
  getCount(): number {
    return this.documents.size;
  }

  /**
   * Clear all documents
   */
  clear(): void {
    for (const doc of this.documents.values()) {
      doc.destroy();
    }
    this.documents.clear();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

// Global document store for the server
export const documentStore = new DocumentStore();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Merge multiple updates into a single update
 * Useful for batching operations
 */
export function mergeUpdates(updates: Uint8Array[]): Uint8Array {
  return Y.mergeUpdates(updates);
}

/**
 * Compute the difference between two states
 */
export function computeDiff(
  fromState: Uint8Array,
  toState: Uint8Array
): Uint8Array {
  const fromDoc = new Y.Doc();
  const toDoc = new Y.Doc();

  Y.applyUpdate(fromDoc, fromState);
  Y.applyUpdate(toDoc, toState);

  const fromVector = Y.encodeStateVector(fromDoc);
  return Y.encodeStateAsUpdate(toDoc, fromVector);
}
