# Converge - Real-Time Collaboration Platform Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   React UI   │  │  Yjs Client  │  │ Socket.IO    │  │  Auth State  │    │
│  │  Components  │  │  (CRDT Doc)  │  │   Client     │  │   (JWT)      │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         └─────────────────┼─────────────────┼─────────────────┘             │
│                           │                 │                               │
└───────────────────────────┼─────────────────┼───────────────────────────────┘
                            │                 │
                            │   WebSocket     │   HTTP/REST
                            │   Connection    │
                            ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Next.js App Router                             │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │  API       │  │  NextAuth  │  │  Socket.IO │  │  CRDT      │     │   │
│  │  │  Routes    │  │  Handler   │  │  Server    │  │  Manager   │     │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │   │
│  │        │               │               │               │            │   │
│  │        └───────────────┼───────────────┼───────────────┘            │   │
│  │                        │               │                            │   │
│  └────────────────────────┼───────────────┼────────────────────────────┘   │
│                           │               │                                 │
└───────────────────────────┼───────────────┼─────────────────────────────────┘
                            │               │
              ┌─────────────┴───────────────┴─────────────┐
              │                                           │
              ▼                                           ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│        PostgreSQL           │         │          Redis              │
│   ┌─────────────────────┐   │         │   ┌─────────────────────┐   │
│   │  Users              │   │         │   │  Pub/Sub            │   │
│   │  Documents          │   │         │   │  Session Cache      │   │
│   │  Operations         │   │         │   │  Presence State     │   │
│   │  Collaborators      │   │         │   │  Room State         │   │
│   │  Snapshots          │   │         │   └─────────────────────┘   │
│   └─────────────────────┘   │         │                             │
└─────────────────────────────┘         └─────────────────────────────┘
```

## 📁 Folder Structure

```
converge/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group routes
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── dashboard/
│   │   └── documents/[id]/
│   ├── api/                      # API Routes
│   │   ├── auth/[...nextauth]/
│   │   ├── documents/
│   │   ├── collaborators/
│   │   └── socket/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/                   # React Components
│   ├── ui/                       # Base UI components
│   ├── editor/                   # Editor components
│   ├── collaboration/            # Collaboration features
│   └── providers/                # Context providers
├── lib/                          # Core libraries
│   ├── auth/                     # Auth utilities
│   ├── crdt/                     # CRDT implementation
│   ├── socket/                   # WebSocket logic
│   ├── db/                       # Database utilities
│   └── utils/                    # General utilities
├── server/                       # Server-side code
│   ├── socket/                   # Socket.IO server
│   ├── collaboration/            # Collaboration engine
│   └── services/                 # Business logic
├── types/                        # TypeScript types
├── prisma/                       # Prisma schema
└── hooks/                        # React hooks
```

## 🔄 Real-Time Sync Flow

### Why CRDT (Yjs) Over Operational Transformation?

We chose **CRDT (Conflict-free Replicated Data Types)** using **Yjs** for these reasons:

1. **No Central Coordination Required**: CRDTs guarantee eventual consistency without requiring a central server to order operations, unlike OT which needs a central transformation engine.

2. **Offline Support**: Users can continue editing offline; changes merge automatically when reconnected.

3. **Mathematical Guarantees**: CRDTs provide mathematical proofs of eventual consistency - all replicas converge to the same state.

4. **Simpler Conflict Resolution**: No need for complex transformation functions; conflicts are resolved by the data structure itself.

5. **Better Scalability**: No single point of failure for conflict resolution.

### Sync Flow Diagram

```
User A types "Hello"              User B types "World"
       │                                   │
       ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│  Yjs Document    │              │  Yjs Document    │
│  (Local State)   │              │  (Local State)   │
└────────┬─────────┘              └────────┬─────────┘
         │                                 │
         │ Generate Update                 │ Generate Update
         ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│  Binary Update   │              │  Binary Update   │
│  (Uint8Array)    │              │  (Uint8Array)    │
└────────┬─────────┘              └────────┬─────────┘
         │                                 │
         │ WebSocket                       │ WebSocket
         ▼                                 ▼
┌─────────────────────────────────────────────────────┐
│                   Socket.IO Server                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  Room: document_123                           │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  Yjs Document (Server Authority)        │  │  │
│  │  │  - Applies all updates                  │  │  │
│  │  │  - Resolves conflicts via CRDT          │  │  │
│  │  │  - Broadcasts merged state              │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │                                 │
         │ Broadcast to Room               │
         ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐
│  User A receives │              │  User B receives │
│  User B's update │              │  User A's update │
│  CRDT auto-merge │              │  CRDT auto-merge │
└──────────────────┘              └──────────────────┘
         │                                 │
         ▼                                 ▼
    Final State:                     Final State:
    "HelloWorld"                     "HelloWorld"
    (Identical!)                     (Identical!)
```

### Conflict Resolution Strategy

```
Scenario: Two users type at the same position simultaneously

User A: Insert "A" at position 5
User B: Insert "B" at position 5

Yjs Resolution:
1. Each operation has a unique ID (clientId + clock)
2. When concurrent inserts occur at same position:
   - Operations are ordered by their unique IDs
   - Deterministic ordering ensures all clients converge
3. Result: "AB" or "BA" (consistent across all clients)

Key Properties:
- Commutative: Order of applying operations doesn't matter
- Associative: Grouping of operations doesn't matter  
- Idempotent: Applying same operation twice has no effect
```

## 🔐 WebSocket Event Flow

### Connection Handshake

```
Client                                      Server
   │                                           │
   │  1. Connect with JWT token                │
   │  ─────────────────────────────────────►  │
   │                                           │
   │  2. Validate JWT                          │
   │     - Check expiry                        │
   │     - Verify signature                    │
   │     - Extract user info                   │
   │                                           │
   │  3. Connection accepted / rejected        │
   │  ◄─────────────────────────────────────  │
   │                                           │
   │  4. join_room { documentId, userId }      │
   │  ─────────────────────────────────────►  │
   │                                           │
   │  5. Verify document access (RBAC)         │
   │     - Check if user has permission        │
   │     - Determine role (owner/editor/viewer)│
   │                                           │
   │  6. room_joined { document, users, role } │
   │  ◄─────────────────────────────────────  │
   │                                           │
   │  7. sync_state { yjsState, version }      │
   │  ◄─────────────────────────────────────  │
   │                                           │
```

### Event Payloads

```typescript
// Join Room
{
  event: "join_room",
  payload: {
    documentId: "uuid",
    userId: "uuid"
  }
}

// Update Operation (CRDT)
{
  event: "update_operation",
  payload: {
    documentId: "uuid",
    update: Uint8Array,    // Yjs binary update
    clientId: number,      // Yjs client ID
    timestamp: number
  }
}

// Cursor Presence
{
  event: "cursor_presence",
  payload: {
    documentId: "uuid",
    userId: "uuid",
    cursor: {
      anchor: number,
      head: number
    },
    user: {
      name: string,
      color: string
    }
  }
}

// Sync State (on reconnect)
{
  event: "sync_state",
  payload: {
    documentId: "uuid",
    state: Uint8Array,     // Full Yjs state
    version: number,
    users: User[]
  }
}
```

## 📊 Data Models

### PostgreSQL Schema (Prisma)

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String
  passwordHash  String
  avatar        String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  documents     Document[]     @relation("DocumentOwner")
  collaborations Collaborator[]
}

model Document {
  id            String         @id @default(uuid())
  title         String
  content       Bytes?         // Yjs state as binary
  ownerId       String
  owner         User           @relation("DocumentOwner", fields: [ownerId], references: [id])
  collaborators Collaborator[]
  snapshots     Snapshot[]
  operations    Operation[]
  version       Int            @default(0)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model Collaborator {
  id         String   @id @default(uuid())
  userId     String
  documentId String
  role       Role     @default(VIEWER)
  user       User     @relation(fields: [userId], references: [id])
  document   Document @relation(fields: [documentId], references: [id])
  createdAt  DateTime @default(now())
  
  @@unique([userId, documentId])
}

enum Role {
  OWNER
  EDITOR
  VIEWER
}

model Operation {
  id         String   @id @default(uuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id])
  userId     String
  data       Bytes    // Yjs update binary
  version    Int
  createdAt  DateTime @default(now())
  
  @@index([documentId, version])
}

model Snapshot {
  id         String   @id @default(uuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id])
  data       Bytes    // Full Yjs state
  version    Int
  createdAt  DateTime @default(now())
  
  @@index([documentId, version])
}
```

## 📈 Scaling Strategy

### Horizontal Scaling to 1000+ Concurrent Users

```
                    Load Balancer (Sticky Sessions)
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │  Server 1    │   │  Server 2    │   │  Server 3    │
    │  Socket.IO   │   │  Socket.IO   │   │  Socket.IO   │
    │  + Next.js   │   │  + Next.js   │   │  + Next.js   │
    └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   Redis Pub/Sub     │
                    │   (Message Broker)  │
                    │                     │
                    │  Channels:          │
                    │  - doc:{id}:updates │
                    │  - doc:{id}:presence│
                    │  - user:{id}:notify │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    │   (Read Replicas)   │
                    └─────────────────────┘
```

### Key Scaling Strategies:

1. **Sticky Sessions**: WebSocket connections are sticky to ensure consistent state within a server instance.

2. **Redis Pub/Sub**: Cross-server communication for broadcasting updates to users on different servers.

3. **Room Sharding**: Documents are assigned to specific server instances based on document ID hash.

4. **Connection Pooling**: Efficient database connections using Prisma's connection pooling.

5. **Snapshot Compaction**: Periodic snapshots reduce operation log size and speed up reconnection.

### Failure Handling

```
Scenario: Server Crash

1. Client detects disconnect
2. Client attempts reconnection with exponential backoff
3. On reconnect:
   a. Re-authenticate via JWT
   b. Rejoin room
   c. Request sync_state from server
   d. Server sends latest Yjs state
   e. Client merges local pending changes
   f. Resume normal operation

No data loss due to:
- CRDT eventual consistency
- Pending operations cached locally
- Server state persisted to PostgreSQL
```

## 🔒 Security Considerations

1. **JWT Validation on WebSocket Connect**: Every connection validated
2. **Room-Level Authorization**: Checked on every join_room event
3. **Rate Limiting**: Cursor updates throttled to prevent spam
4. **Input Validation**: All payloads validated with Zod schemas
5. **CORS Configuration**: Strict origin policies
6. **Secure Cookies**: HTTP-only, secure, SameSite cookies for sessions
