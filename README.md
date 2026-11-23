# CollabSpace

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/codex-yasxh/CollabSpace)

CollabSpace is a real-time collaborative document editing platform modeled after Google Docs. It provides conflict-free multi-user text editing, live presence indicators, deterministic collaborator colors, granular role-based access control, debounced database persistence, and offline reconnection convergence.

---

## 1. Prerequisites

- **Docker Desktop** (version 24+ recommended, with Compose v2)
- **Node.js** (v20+ LTS recommended)
- **npm** (v10+ recommended)

> [!IMPORTANT]
> **Always demo from `http://localhost:5173`, in both windows, with Docker Desktop started first.**
> Ensure Docker Desktop is running before starting the development server.

---

## 2. Quick Start Setup

Follow these steps to set up and start the application from a clean repository clone:

```bash
# 1. Start PostgreSQL database container in the background
docker compose up -d

# 2. Copy the environment variables template for the server
cp server/.env.example server/.env

# 3. Install dependencies, run database migrations, and seed initial demo data
npm install
npm run migrate
npm run seed

# 4. Start both Express backend (port 3001) and Vite frontend (port 5173) concurrently
npm run dev
```

*(On Windows PowerShell, use `Copy-Item server/.env.example server/.env`)*

Once running, open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 3. Demo User Accounts

The idempotent seed script (`npm run seed`) provisions three test accounts with pre-configured roles on a demo document:

| User | Email | Password | Role on Demo Document |
| :--- | :--- | :--- | :--- |
| **Alice** | `alice@example.com` | `demo-password-1` | **Owner** |
| **Bob** | `bob@example.com` | `demo-password-1` | **Editor** |
| **Charlie** | `charlie@example.com` | `demo-password-1` | **Viewer** |

- **Demo Document**: *"CollabSpace Product Specification"* (pre-populated with headings, paragraphs, and bullet points encoded directly in Yjs binary format).

---

## 4. Section 10: Step-by-Step Live Demo Script

Use this two-window script (Chrome standard window + Chrome incognito window) to demonstrate all real-time collaboration features, presence awareness, and security boundaries.

### Step 1: Open Side-by-Side Windows
1. Open **Window 1** (Standard Chrome): Navigate to `http://localhost:5173`.
2. Open **Window 2** (Incognito Window): Navigate to `http://localhost:5173`.
   *(Using an incognito window ensures separate cookie sessions on the same localhost domain).*

### Step 2: Sign In as Collaborators
1. In **Window 1**, log in with:
   - Email: `alice@example.com`
   - Password: `demo-password-1`
   - *Result*: Redirects to Alice's document dashboard.
2. In **Window 2**, log in with:
   - Email: `bob@example.com`
   - Password: `demo-password-1`
   - *Result*: Redirects to Bob's document dashboard.

### Step 3: Open the Seeded Document
1. In both windows, click on **"CollabSpace Product Specification"**.
2. Both collaborators enter the document editor simultaneously.
3. Observe the top header bar:
   - **Avatar Stack**: Displays the active collaborators. Each user has a deterministic, consistent presence color derived from their user ID.
   - **Save Status**: Displays `"Saved <HH:MM>"` indicating the document is synchronized with the database.

### Step 4: Real-Time Typing & Caret Awareness
1. In **Window 1** (Alice), click into a paragraph and type a new sentence.
2. In **Window 2** (Bob), observe:
   - Alice's edits appear instantaneously character-by-character.
   - Alice's colored cursor and name flag (`Alice`) track her exact cursor position in real time.
3. In **Window 2** (Bob), type into a bullet list item.
4. In **Window 1** (Alice), observe Bob's edits and cursor flag (`Bob`) streaming without conflicts.

### Step 5: Rapid Refresh Idempotency Test
1. Rapidly refresh **Window 1** three times (`Ctrl+R` or `Cmd+R`).
2. Rapidly refresh **Window 2** three times.
3. **Verify**:
   - The document content never duplicates or multiplies headings/paragraphs.
   - WebSocket connection re-establishes smoothly within milliseconds.
   - Save status transitions from `"Connecting..."` $\rightarrow$ `"Saved <HH:MM>"`.

### Step 6: Presence Disconnect & Ghost Cursor Elimination
1. Close **Window 2** (Bob's tab).
2. In **Window 1** (Alice), watch the avatar stack and editor canvas.
3. **Verify**:
   - Within 2-3 seconds, Bob's avatar disappears from the collaborator stack.
   - Bob's caret and name tag are cleanly removed from the document canvas without leaving ghost artifacts.

### Step 7: Offline Editing & CRDT Reconnection Convergence
1. Re-open **Window 2** as Bob and open the document.
2. In **Window 2** (Bob), open Chrome DevTools (`F12`), switch to the **Network** tab, and toggle the throttling dropdown to **Offline**.
3. In **Window 2**, observe the header status changes to: `"Offline. Your changes will sync when you reconnect."`.
4. Make concurrent offline edits:
   - In **Window 1** (Alice, Online): Add `"[ALICE ONLINE UPDATE]"` at the beginning of the introduction paragraph.
   - In **Window 2** (Bob, Offline): Add `"[BOB OFFLINE UPDATE]"` at the end of the same paragraph.
5. In **Window 2** (Bob), restore the network connection to **No throttling** (Online).
6. **Verify**:
   - Both windows converge to the exact same text within milliseconds.
   - Neither edit was dropped, overwritten, or duplicated.
   - Save status returns to `"Saved <HH:MM>"`.

### Step 8: Granular Permissions & Viewer Mode
1. In **Window 1** (Alice, Owner), click the **Share** button.
2. Observe the Share Dialog:
   - Lists Alice (Owner) and Bob (Editor).
   - Allows searching for users by email and changing roles (`Editor`, `Viewer`).
   - Allows configuring link sharing (`Restricted`, `Anyone with link can view`, `Anyone with link can edit`).
3. Open a third window (or log Bob out in Window 2) and sign in as **Charlie** (`charlie@example.com` / `demo-password-1`).
4. Charlie opens the document.
5. **Verify**:
   - Charlie sees a `"Viewer"` badge in the header.
   - The rich text formatting toolbar is disabled (buttons are inactive and non-clickable).
   - A banner displays: *"You have read-only access to this document."*
   - When Alice types in Window 1, Charlie sees Alice's live updates.
   - If Charlie attempts to modify the text in the browser DOM, the server's WebSocket write-filter silently drops the mutation updates without crashing.

### Step 9: Real-Time Permission Eviction
1. With Bob (Window 2) viewing the document as an Editor, Alice (Window 1) opens the **Share** dialog and downgrades Bob to **Viewer** or removes him.
2. **Verify**:
   - The backend immediately terminates Bob's active WebSocket connection (`4403 Forbidden`).
   - Bob's client immediately reflects the updated permissions without requiring a manual browser reload.

---

## 5. System Architecture

CollabSpace combines modern CRDT synchronization with standard relational persistence and WebSocket protocols.

```mermaid
flowchart TD
    subgraph Browser Clients
        C1["Alice (Chrome Window 1)<br/>Tiptap + y-websocket"]
        C2["Bob (Chrome Window 2)<br/>Tiptap + y-websocket"]
        C3["Charlie (Viewer)<br/>Read-only Tiptap"]
    end

    subgraph Frontend Delivery
        Vite["Vite Dev Server (:5173)<br/>Reverse Proxy /api & /ws"]
    end

    subgraph Backend Server (:3001)
        HTTP["Express HTTP API<br/>Auth, Docs, Sharing"]
        WSS["WebSocket Server (/ws)<br/>Handshake Auth & Validation"]
        RM["RoomManager<br/>In-Memory Room Registry"]
        
        subgraph DocumentRoom
            YDoc["Y.Doc (CRDT)<br/>Fragment: 'default'"]
            Awareness["Awareness Protocol<br/>Presence, Carets & Flags"]
            WriteFilter["Viewer Write Filter<br/>Drops unauth Sync updates"]
            Debounce["Debounced Persist<br/>2000ms idle / 10s max debounce<br/>Immediate flush on disconnect"]
        end
    end

    subgraph Storage Layer
        PG[("PostgreSQL Database<br/>users, documents, members<br/>content_state bytea")]
    end

    C1 <-->|HTTP / WS| Vite
    C2 <-->|HTTP / WS| Vite
    C3 <-->|HTTP / WS| Vite
    Vite <-->|REST API| HTTP
    Vite <-->|WebSocket| WSS

    HTTP -->|Auth & Metadata| PG
    WSS -->|Upgrade & Verify Cookie| RM
    RM --> DocumentRoom
    DocumentRoom --> YDoc
    DocumentRoom --> Awareness
    DocumentRoom --> WriteFilter
    DocumentRoom --> Debounce
    Debounce -->|Binary State Flush| PG
```

### Key Components

1. **Client SPA (`client/`)**:
   - Built with **React 18**, **Tiptap v2**, **Yjs**, **y-websocket**, and **Tailwind CSS**.
   - Custom extensions: `@tiptap/extension-collaboration` (configured with `document: session.ydoc` in [DocumentPage.tsx](client/src/pages/DocumentPage.tsx#L78-L80)) and `@tiptap/extension-collaboration-caret` ([DocumentPage.tsx](client/src/pages/DocumentPage.tsx#L81-L90)).
   - Custom hook `useSaveStatus`: listens to custom protocol messages (message type `4`, `MSG_SAVE`) via `provider.messageHandlers[4]` to display real-time save states (`"Connecting"`, `"Saving"`, `"Saved HH:MM"`, `"Offline"`) in [useSaveStatus.ts](client/src/hooks/useSaveStatus.ts#L61-L86).

2. **Express & WebSocket Backend (`server/`)**:
   - REST API handles authentication, document creation, search, deletion, and sharing permissions.
   - `wsServer.ts` intercepts WebSocket upgrade requests on `/collab/:documentId` ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L41-L57)), parses the `cs_session` HTTP-only cookie ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L73)), verifies the JWT token ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L80-L90)), validates origin against `ALLOWED_ORIGINS` ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L66-L70)), and resolves document permissions before granting connection ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L106-L110)).
   - Enforces the permission matrix: `OWNER` > `EDITOR` > `VIEWER` > `NONE` via `resolveRole` in [resolveRole.ts](server/src/modules/access/resolveRole.ts#L12-L32).

3. **In-Memory Collaboration Engine (`server/src/modules/collaboration/`)**:
   - **`RoomManager`** ([roomManager.ts](server/src/modules/collaboration/roomManager.ts#L3-L126)): Manages document rooms in memory. Implements concurrent cold-load promise caching (`rooms: Map<string, Promise<Room>>` at line 4) and room eviction on document deletion (`evictRoomOnDelete` at lines 62-84).
   - **`Room`** ([room.ts](server/src/modules/collaboration/room.ts#L17-L162)): Wraps the document's `Y.Doc` and awareness instance. Manages active connections (`conns: Set<Connection>` at line 21).
   - **Debounced Persistence** ([room.ts](server/src/modules/collaboration/room.ts#L85-L102)): Buffers changes in memory using a 2000ms idle debounce with a 10,000ms maximum wait from the first unpersisted edit (`Math.min(2000, Math.max(0, 10000 - (now - this.firstDirtyAt)))` at line 98).
   - **Immediate Flush on Last Connection Departure** ([protocol.ts](server/src/modules/collaboration/protocol.ts#L208-L210) & [room.ts](server/src/modules/collaboration/room.ts#L148-L152)): When the last client disconnects from a room (`room.conns.size === 0`), `onLastConnectionLeft()` triggers an immediate database flush without delay.

---

## 6. Documented Limitations

1. **Single-Node In-Memory Architecture**:
   - CollabSpace currently maintains active document rooms in single-process Node.js memory. For multi-server horizontal scaling, a pub/sub clustering layer (such as Redis or `y-redis`) would be required to coordinate updates between nodes.
2. **Link Access Non-Member Persistence**:
   - Users who access a document via link sharing ("Anyone with link can view/edit") can collaborate in real time while connected, but are not permanently inserted into the `document_members` table unless explicitly invited.
3. **Document Title Synchronization**:
   - Document titles are persisted via standard REST requests rather than synchronized character-by-character over the Yjs CRDT stream.
4. **Transient "Offline" Notice on Permission Revocation**:
   - When a user's role is changed or revoked while they are actively connected, the server immediately severs their WebSocket connection. The client briefly displays an `"Offline"` banner before re-authenticating or redirecting.

---

## 7. Section 11: Technical Viva Answers

### Q1: Why use a CRDT (Yjs / YATA) instead of Operational Transformation (OT)?
**Answer**:
- **Operational Transformation (OT)** requires a centralized server to linearize operations and transform concurrent operation pairs ($O_1' = T(O_1, O_2)$). If operations arrive out of order, or if clients edit while disconnected, the transformation matrix becomes exponentially complex and prone to edge-case desynchronization.
- **Yjs (YATA algorithm)** is a Conflict-free Replicated Data Type. Instead of transforming operations, it assigns every character/node a globally unique, immutable identifier `(client, clock)`. Operations commute mathematically: regardless of the order in which two peers receive updates, their internal graph converges to the identical sequence.
- **Code implementation**:
  - Client editor binding: [DocumentPage.tsx](client/src/pages/DocumentPage.tsx#L78-L80) configures `Collaboration.configure({ document: session.ydoc })`.
  - Server room binding: [room.ts](server/src/modules/collaboration/room.ts#L19) maintains `readonly doc: Y.Doc`.
  - Update propagation: [protocol.ts](server/src/modules/collaboration/protocol.ts#L109-L123) listens on `room.doc.on("update")` and broadcasts raw CRDT binary updates via `syncProtocol.writeUpdate` to all peer connections.

### Q2: How do State Vectors and Vector Clocks work in Yjs synchronization?
**Answer**:
- In Yjs, each client maintains an internal monotonic counter (clock) that increments with each atomic operation. A **State Vector** is a compact representation of the highest clock seen for every client ID: `{ [clientId: number]: number }`.
- In CollabSpace, the client and server exchange state vectors using the standard `y-protocols/sync` two-step handshake:
  1. **Sync Step 1 (State Vector Exchange)**: Upon connection attachment in [protocol.ts](server/src/modules/collaboration/protocol.ts#L153-L157), the server transmits its State Vector to the client using `syncProtocol.writeSyncStep1(syncEncoder, room.doc)`. The client's `WebsocketProvider` simultaneously sends its own State Vector.
  2. **Sync Step 2 (Differential Update)**: When the server receives the client's sync message in [protocol.ts](server/src/modules/collaboration/protocol.ts#L61-L69), `syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn)` internally evaluates the client's state vector against the server document using `Y.encodeStateAsUpdate(doc, clientStateVector)` (diff update) and sends back only the missing operations.
  3. **Delta Application**: When either peer receives Step 2 updates, `readSyncMessage` applies the missing delta to the local `Y.Doc` using `Y.applyUpdate(doc, update, origin)`.
- **Efficiency**: Instead of transferring the entire document content across the wire on every connection, Yjs exchanges only the differential slice missing from the receiver.

### Q3: How does the Eviction and Room Lifecycle strategy work?
**Answer**:
- **Cold Room Loading**: When a client requests a document not currently in server memory, `RoomManager.getRoom(docId)` in [roomManager.ts](server/src/modules/collaboration/roomManager.ts#L10-L20) creates and caches a loading promise (`this.rooms.set(docId, p)`), calling `Room.load(docId)` in [room.ts](server/src/modules/collaboration/room.ts#L44-L62) to asynchronously fetch `content_state bytea` from PostgreSQL. Caching the promise ensures concurrent cold requests share a single database query.
- **Message Buffering**: To prevent race conditions during this asynchronous I/O window, incoming WebSocket messages are placed in an in-memory queue (`earlyMessages` in [index.ts](server/src/modules/collaboration/index.ts#L17-L40)). Once `Room.load` completes, the connection is attached and buffered messages are replayed into the socket event emitter.
- **Immediate Flush on Last Client Departure**: In [protocol.ts](server/src/modules/collaboration/protocol.ts#L208-L210), when a connection closes and `room.conns.size === 0`, the server calls `room.onLastConnectionLeft()` in [room.ts](server/src/modules/collaboration/room.ts#L148-L152), immediately executing an asynchronous database flush if dirty.
- **Eviction on Document Deletion**: When a document is deleted via REST API, `roomManager.evictRoomOnDelete(docId)` in [roomManager.ts](server/src/modules/collaboration/roomManager.ts#L62-L84) deletes the room from memory, cancels any pending debounce timers, sets `dirty = false`, closes all active sockets with code `4404` ("Document deleted"), and destroys the room.
- **Graceful Process Shutdown**: Traps for `SIGTERM` and `SIGINT` in [index.ts](server/src/modules/collaboration/index.ts#L51-L56) call `roomManager.flushAllRooms()` ([roomManager.ts](server/src/modules/collaboration/roomManager.ts#L89-L103)) to persist all dirty rooms before process exit.

### Q4: How does the Debounced Persistence mechanism handle edits that arrive during an active flush?
**Answer**:
- Naive implementations that clear a `dirty` flag upon asynchronous database completion risk losing edits that arrive while the `UPDATE` query is in-flight.
- **CollabSpace Version Tracking Solution** ([room.ts](server/src/modules/collaboration/room.ts#L33, L113-L134) & [protocol.ts](server/src/modules/collaboration/protocol.ts#L109-L123)):
  1. The room maintains a monotonic version counter: `this.currentVersion: number = 0` in [room.ts](server/src/modules/collaboration/room.ts#L33).
  2. Every time an edit update is applied to `room.doc`, `room.currentVersion++` is executed in [protocol.ts](server/src/modules/collaboration/protocol.ts#L110).
  3. When `flush()` initiates in [room.ts](server/src/modules/collaboration/room.ts#L104-L146), it captures the exact version at query start: `const versionAtStart = this.currentVersion` ([room.ts](server/src/modules/collaboration/room.ts#L114)).
  4. The binary update `Y.encodeStateAsUpdate(this.doc)` is written to PostgreSQL ([room.ts](server/src/modules/collaboration/room.ts#L117-L121)).
  5. Upon database query completion, the room checks `if (this.currentVersion === versionAtStart)` ([room.ts](server/src/modules/collaboration/room.ts#L124)):
     - **Clean**: If no new edits arrived, `this.dirty = false; this.lastSavedAt = Date.now();` and the server broadcasts `MSG_SAVE` (`"saved"`) with the timestamp to all clients ([room.ts](server/src/modules/collaboration/room.ts#L125-L127)).
     - **Dirty**: If edits arrived during the database query (`this.currentVersion !== versionAtStart`), `this.dirty = true; this.firstDirtyAt = Date.now();` is retained, and a new flush is scheduled after 2000ms ([room.ts](server/src/modules/collaboration/room.ts#L128-L134)).
  6. **Flush Serialization**: If `flush()` is invoked while another flush is currently running (`this.flushing === true`), `this.flushQueued = true` ensures that another flush will immediately execute as soon as the active query finishes ([room.ts](server/src/modules/collaboration/room.ts#L105-L107, L141-L144)).

### Q5: How are security and authorization boundaries enforced across REST and WebSockets?
**Answer**:
- **Handshake Authentication**: The WebSocket upgrade handler in [wsServer.ts](server/src/modules/collaboration/wsServer.ts#L41-L120) extracts the `cs_session` cookie via `parseCookie(req.headers.cookie, "cs_session")` ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L73)) and verifies the JWT payload (`{ sub: userId }`) using `jwt.verify` ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L80-L90)). Invalid tokens or missing cookies are rejected immediately with HTTP 401.
- **Allowed Origin Check**: Upgrades must originate from an origin specified in `env.ALLOWED_ORIGINS` ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L66-L70)), rejecting spoofed cross-origin sockets with HTTP 403.
- **Role Resolution Hierarchy**: Permissions are resolved in [resolveRole.ts](server/src/modules/access/resolveRole.ts#L12-L32) according to the precedence:
  $$\text{OWNER} > \text{EDITOR} > \text{VIEWER} > \text{NONE}$$
  Users without access are rejected during handshake with HTTP 403 ([wsServer.ts](server/src/modules/collaboration/wsServer.ts#L106-L110)).
- **Viewer Write Filtering**:
  - The WebSocket protocol uses `y-protocols/sync` messages. Sync Step 2 / update packets (message type 0) contain document mutations.
  - For clients with `role === "VIEWER"`, [protocol.ts](server/src/modules/collaboration/protocol.ts#L48-L59) inspects the packet header. If `syncSubType !== syncProtocol.messageYjsSyncStep1`, the server silently drops the update packet without broadcasting or applying it to `room.doc`.
  - Awareness messages (type 1) from Viewers are permitted ([protocol.ts](server/src/modules/collaboration/protocol.ts#L73-L92)), allowing Viewers to share cursor positions and view collaborators without being able to mutate content.
- **Real-Time Eviction**: When a user's membership role or document link access is modified or revoked in [memberService.ts](server/src/modules/documents/memberService.ts#L60, L88) or [documentService.ts](server/src/modules/documents/documentService.ts#L46), the server calls `roomManager.closeAllConnections(docId, 4403, "Access changed")` ([roomManager.ts](server/src/modules/collaboration/roomManager.ts#L41-L56)), severing the socket immediately.

---

## 8. Verification & Test Suite

The project includes an end-to-end automated test suite covering unit logic, permission matrices, REST APIs, WebSocket protocols, and CRDT convergence.

Integration tests run against an isolated test database (`collabspace_test`) configured in `server/vitest.config.ts`. On a fresh PostgreSQL container, provision the test database before running tests:

```bash
# 1. Create the test database in the PostgreSQL container (if not already present)
docker exec collabspace-postgres psql -U collabspace -c "CREATE DATABASE collabspace_test;"

# 2. Apply migrations to the test database
DATABASE_URL=postgresql://collabspace:collabspace_dev@localhost:5432/collabspace_test npm run migrate
# (On Windows PowerShell: $env:DATABASE_URL="postgresql://collabspace:collabspace_dev@localhost:5432/collabspace_test"; npm run migrate)

# 3. Run the complete test suite across both server and client
npm test

# 4. Run TypeScript typechecks across both packages
npm run typecheck

# 5. Run ESLint across the repository
npm run lint
```

- **Server Suite**: 92 tests passing (Vitest, Supertest, real PostgreSQL and real WebSocket connections).
- **Client Suite**: 12 tests passing (URL sanitization, presence colors, save status transitions).
- **Total**: 104 automated tests with zero warnings and zero TypeScript errors.
