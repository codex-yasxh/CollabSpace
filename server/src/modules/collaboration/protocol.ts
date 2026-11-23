import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { WebSocket } from "ws";
import type { Room, Connection } from "./room.js";

export const MSG_SYNC = 0;
export const MSG_AWARENESS = 1;
export const MSG_SAVE = 4;

export function send(conn: Connection, message: Uint8Array): void {
  if (conn.ws.readyState === WebSocket.OPEN) {
    try {
      conn.ws.send(message, (err) => {
        if (err) {
          try {
            conn.ws.close();
          } catch {
            // ignore
          }
        }
      });
    } catch {
      try {
        conn.ws.close();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Handles incoming binary packets from a connection.
 * Implements strict byte-level Viewer write filtering per skills.md 5.4.
 */
export function handleIncomingMessage(
  room: Room,
  conn: Connection,
  data: Uint8Array,
): void {
  try {
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MSG_SYNC) {
      if (conn.role === "VIEWER") {
        // Peek at sync sub-type without consuming original decoder
        const peek = decoding.createDecoder(data);
        decoding.readVarUint(peek); // Skip message type (0)
        const syncSubType = decoding.readVarUint(peek); // Read sync sub-type

        // Viewers are only permitted to send sync step 1 (0)
        if (syncSubType !== syncProtocol.messageYjsSyncStep1) {
          // Drop silently (debug log); never throw, never apply update
          return;
        }
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      // Process sync message (answers step 1 with step 2; applies step 2 / update with origin = conn)
      syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);

      // If readSyncMessage produced a response (e.g. answering step 1 with step 2), send it back
      if (encoding.length(encoder) > 1) {
        send(conn, encoding.toUint8Array(encoder));
      }
      return;
    }

    if (messageType === MSG_AWARENESS) {
      const rawUpdate = decoding.readVarUint8Array(decoder);

      // Track awareness clientIDs belonging to this connection so they can be cleaned on disconnect
      try {
        const peek = decoding.createDecoder(rawUpdate);
        const count = decoding.readVarUint(peek);
        for (let i = 0; i < count; i++) {
          const clientID = decoding.readVarUint(peek);
          decoding.readVarUint(peek); // clock
          decoding.readVarString(peek); // json string
          conn.awarenessIds.add(clientID);
        }
      } catch {
        // Awareness peek failed; proceed to apply
      }

      awarenessProtocol.applyAwarenessUpdate(room.awareness, rawUpdate, conn);
      return;
    }

    // Ignore unknown message types safely
  } catch {
    // Malformed packet from client: close with 1003 (unsupported data) and never crash process
    try {
      conn.ws.close(1003, "Invalid packet");
    } catch {
      // ignore
    }
  }
}

/**
 * Initializes room event listeners for document updates and awareness broadcasts.
 */
export function attachRoomEventHandlers(room: Room): void {
  room.doc.on("update", (update: Uint8Array, origin: unknown) => {
    room.currentVersion++;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);

    for (const c of room.conns) {
      if (c !== origin) {
        send(c, msg);
      }
    }

    room.markDirty();
  });

  room.awareness.on(
    "update",
    ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, changed),
      );
      const msg = encoding.toUint8Array(encoder);

      for (const c of room.conns) {
        if (c !== origin) {
          send(c, msg);
        }
      }
    },
  );
}

/**
 * Attaches a newly upgraded connection to a Room.
 * Sends sync step 1, current awareness, and listens for messages/disconnect.
 */
export function attachConnection(room: Room, conn: Connection): void {
  room.conns.add(conn);

  // 1. Send sync step 1 from server so client answers with step 2
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(syncEncoder, room.doc);
  send(conn, encoding.toUint8Array(syncEncoder));

  // 2. Send current awareness states if any exist
  const currentStates = room.awareness.getStates();
  if (currentStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(currentStates.keys()),
      ),
    );
    send(conn, encoding.toUint8Array(awarenessEncoder));
  }

  // 3. Send current save status (from T5.4)
  room.sendSaveStatus(conn);

  // 4. Message listener
  conn.ws.on("message", (data: unknown) => {
    let bytes: Uint8Array;
    if (Buffer.isBuffer(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      bytes = new Uint8Array(Buffer.concat(data));
    } else if (typeof data === "string") {
      bytes = new Uint8Array(Buffer.from(data));
    } else {
      return;
    }
    handleIncomingMessage(room, conn, bytes);
  });

  // 5. Close listener
  conn.ws.on("close", () => {
    room.conns.delete(conn);

    // Remove awareness states associated with this connection
    if (conn.awarenessIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        Array.from(conn.awarenessIds),
        null,
      );
    }

    // If last connection left, flush persistence
    if (room.conns.size === 0) {
      void room.onLastConnectionLeft();
    }
  });

  conn.ws.on("error", () => {
    try {
      conn.ws.close();
    } catch {
      // ignore
    }
  });
}
