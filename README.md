# CollabSpace

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

## 2. Quick Start (3-Command Setup)

Follow these steps to set up and start the application from a clean repository clone:

```bash
# 1. Start PostgreSQL database container in the background
docker compose up -d

# 2. Install dependencies, run database migrations, and seed initial demo data
npm install
npm run migrate
npm run seed

# 3. Start both Express backend (port 3001) and Vite frontend (port 5173) concurrently
npm run dev
```

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
            Debounce["Debounced Persist<br/>2000ms flush + 30s eviction"]
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
   - Custom extensions: `@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-cursor`.
   - Custom hook `useSaveStatus`: listens to custom protocol messages (message type `4`) to display real-time save states (`"Saved"`, `"Saving..."`, `"Offline"`).

2. **Express & WebSocket Backend (`server/`)**:
   - REST API handles authentication, document creation, search, deletion, and sharing permissions.
   - `wsServer.ts` intercepts WebSocket upgrade requests on `/ws`, parses the `cs_session` HTTP-only cookie, and validates document membership before granting connection.
   - Enforces the permission matrix: `OWNER` > `EDITOR` > `VIEWER` > `NONE`.

3. **In-Memory Collaboration Engine (`server/src/modules/collaboration/`)**:
   - **`RoomManager`**: Manages document rooms in memory. Implements cold-load message buffering so messages arriving during database queries are not lost.
   - **`DocumentRoom`**: Wraps the document's `Y.Doc`. Applies incoming binary sync updates, manages collaborator awareness states, and drops unauthorized updates from Viewers.
   - **Debounced Persistence**: Buffers changes in memory and flushes binary state (`Y.encodeStateAsUpdate(ydoc)`) to PostgreSQL after 2000ms of inactivity, or immediately upon the last collaborator's departure.
   - **Eviction Timer**: Automatically releases idle document rooms from server memory 30 seconds after the last connection disconnects.

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
- **Operational Transformation (OT)** requires a central server to linearize and transform concurrent operation pairs ($O_1' = T(O_1, O_2)$). If operations arrive out of order, or if clients edit while disconnected, the transformation matrix becomes exponentially complex and prone to edge-case desynchronization.
- **Yjs (YATA algorithm)** is a Conflict-free Replicated Data Type. Instead of transforming operations, it assigns every character/node a globally unique, immutable identifier `(client, clock)`. Operations commute mathematically: regardless of the order in which two peers receive updates, their internal graph converges to the identical sequence.
- **Benefits for CollabSpace**:
  1. Complete tolerance to network latency and out-of-order delivery.
  2. Native, effortless offline editing and seamless reconnection convergence.
  3. No need for complex lock managers or operation log rewriters on the server.

### Q2: How do State Vectors and Vector Clocks work in Yjs synchronization?
**Answer**:
- In Yjs, each client maintains an internal monotonic counter (clock) that increments with each atomic operation.
- A **State Vector** is a compact representation of the highest clock seen for every client ID: `{ [clientId: number]: number }`.
- When a client connects or reconnects:
  1. The client transmits its State Vector (Step 1 Sync) using `Y.encodeStateVector(ydoc)`.
  2. The server compares the client's vector against its own document state.
  3. The server computes only the missing operations using `Y.diffUpdate(ydoc, clientStateVector)` and transmits them back (Step 2 Sync).
- **Efficiency**: Instead of transferring the entire document content across the wire on every connection, Yjs exchanges only the differential slice missing from the receiver.

### Q3: How does the Eviction and Room Lifecycle strategy work?
**Answer**:
- **Cold Room Loading**: When a client requests a document not currently in server memory, the server creates a `DocumentRoom` and initiates an asynchronous query to fetch `content_state bytea` from PostgreSQL.
- **Message Buffering**: To prevent race conditions during this asynchronous I/O window, incoming WebSocket messages are placed in a memory queue. Once the database load completes, buffered updates are applied in order before processing live traffic.
- **Eviction Timer**: To prevent server memory exhaustion (OOM), rooms are not held in memory indefinitely. When the last client disconnects from a room:
  1. An immediate database flush is triggered to ensure zero data loss.
  2. A 30-second eviction timer is initiated.
  3. If another client connects within 30 seconds, the timer is cleared and the room stays warm.
  4. If the timer expires, the room is deleted from the `RoomManager` memory map, allowing Node.js garbage collection to reclaim memory.

### Q4: How does the Debounced Persistence mechanism handle edits that arrive during an active flush?
**Answer**:
- In naive implementations, an asynchronous write to the database (`UPDATE documents SET content_state = $1`) can overwrite newer edits that arrived while the database query was running, or clear the `dirty` flag prematurely.
- **CollabSpace Version Tracking Solution**:
  1. The room maintains two counters: `editVersion` (incremented on every local or remote edit) and `lastFlushedVersion`.
  2. When the debounce timer (2000ms) fires, the room captures the current version: `flushingVersion = this.editVersion`.
  3. The room encodes the state and writes to PostgreSQL.
  4. When the database query succeeds, `this.lastFlushedVersion = flushingVersion`.
  5. The room checks: `if (this.editVersion > this.lastFlushedVersion)`. If new edits arrived during the database query, the room remains `dirty` and schedules another debounced flush. If no new edits arrived, `dirty` is set to `false`, and custom message type `4` (`SAVED`) is broadcast to all connected clients.

### Q5: How are security and authorization boundaries enforced across REST and WebSockets?
**Answer**:
- **Handshake Authentication**: The WebSocket upgrade handler (`server/src/modules/collaboration/wsServer.ts`) parses the HTTP-only `cs_session` cookie and verifies the JWT payload (`{ sub: userId }`). Unauthenticated upgrade requests are rejected immediately with HTTP 401.
- **Role Resolution**: Permissions are evaluated via `resolveRole(userId, documentId)` enforcing:
  $$\text{OWNER} > \text{EDITOR} > \text{VIEWER} > \text{NONE}$$
  Link access settings are checked if the user is not an explicit member.
- **Viewer Write Filtering**:
  - The WebSocket protocol uses `y-protocols` sync messages. Message Type 0 (Sync) contains Step 2 updates containing document mutations.
  - For clients with `VIEWER` role, the server parses the message header. If it contains a write update, the server silently discards it without broadcasting it or applying it to the server's `Y.Doc`.
  - Type 1 (Awareness / presence) messages from Viewers are permitted, allowing Viewers to share their cursor position and view others without being able to modify text.
- **Real-Time Eviction**: When an Owner changes a user's role or link access via REST API, the server calls `roomManager.evictConnection(documentId, userId)`. The active socket is closed with status code `4403`, immediately revoking access.

---

## 8. Verification & Test Suite

The project includes an end-to-end automated test suite covering unit logic, permission matrices, REST APIs, WebSocket protocols, and CRDT convergence:

```bash
# Run the complete test suite across both server and client
npm test

# Run TypeScript typechecks across both packages
npm run typecheck

# Run ESLint across the repository
npm run lint
```

- **Server Suite**: 92 tests passing (Vitest, Supertest, real PostgreSQL and real WebSocket connections).
- **Client Suite**: 12 tests passing (URL sanitization, presence colors, save status transitions).
- **Total**: 104 automated tests with zero warnings and zero TypeScript errors.
