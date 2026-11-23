import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import type { WebSocket } from "ws";
import type { User } from "../users/userRepository.js";
import type { DocumentRole } from "../access/resolveRole.js";
import { query } from "../../database/db.js";
import { MSG_SAVE, send, attachRoomEventHandlers } from "./protocol.js";

export interface Connection {
  ws: WebSocket;
  user: User;
  role: DocumentRole;
  awarenessIds: Set<number>;
}

export class Room {
  readonly id: string;
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  readonly conns: Set<Connection> = new Set();

  // Persistence state
  dirty: boolean = false;
  firstDirtyAt: number = 0;
  saveStatus: "saving" | "saved" = "saved";
  lastSavedAt: number = Date.now();
  timer: NodeJS.Timeout | null = null;
  flushing: boolean = false;
  flushQueued: boolean = false;

  // Version counter to detect edits arriving DURING an in-flight flush
  currentVersion: number = 0;

  constructor(id: string, doc: Y.Doc, awareness: awarenessProtocol.Awareness) {
    this.id = id;
    this.doc = doc;
    this.awareness = awareness;

    // Attach document update and awareness broadcast listeners
    attachRoomEventHandlers(this);
  }

  static async load(docId: string): Promise<Room> {
    const result = await query<{ content_state: Buffer | Uint8Array | null }>(
      `SELECT content_state FROM documents WHERE id = $1`,
      [docId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Document ${docId} not found`);
    }

    const doc = new Y.Doc();
    const contentState = result.rows[0]?.content_state;
    if (contentState && contentState.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(contentState));
    }

    const awareness = new awarenessProtocol.Awareness(doc);
    return new Room(docId, doc, awareness);
  }

  broadcastSave(status: "saving" | "saved", timestampMs?: number): void {
    this.saveStatus = status;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SAVE);
    encoding.writeVarUint(encoder, status === "saving" ? 0 : 1);
    encoding.writeVarUint(encoder, timestampMs ?? Date.now());
    const msg = encoding.toUint8Array(encoder);

    for (const c of this.conns) {
      send(c, msg);
    }
  }

  sendSaveStatus(conn: Connection): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SAVE);
    encoding.writeVarUint(encoder, this.saveStatus === "saving" ? 0 : 1);
    encoding.writeVarUint(encoder, this.lastSavedAt);
    send(conn, encoding.toUint8Array(encoder));
  }

  markDirty(): void {
    const now = Date.now();
    if (!this.dirty) {
      this.dirty = true;
      this.firstDirtyAt = now;
      this.broadcastSave("saving");
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    // 2s idle debounce with 10s max wait from first edit
    const wait = Math.min(2000, Math.max(0, 10000 - (now - this.firstDirtyAt)));
    this.timer = setTimeout(() => {
      void this.flush();
    }, wait);
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      this.flushQueued = true;
      return;
    }
    if (!this.dirty) {
      return;
    }

    this.flushing = true;
    const versionAtStart = this.currentVersion;

    try {
      const bytes = Y.encodeStateAsUpdate(this.doc);
      await query(
        `UPDATE documents SET content_state = $1, updated_at = now() WHERE id = $2`,
        [Buffer.from(bytes), this.id],
      );

      // Edits that arrive DURING a flush must not be marked clean by it
      if (this.currentVersion === versionAtStart) {
        this.dirty = false;
        this.lastSavedAt = Date.now();
        this.broadcastSave("saved", this.lastSavedAt);
      } else {
        // More edits arrived while writing to DB -> stay dirty and schedule flush
        this.dirty = true;
        this.firstDirtyAt = Date.now();
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.flush(), 2000);
      }
    } catch (err) {
      // Stay dirty, retry after 2s
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), 2000);
    } finally {
      this.flushing = false;
      if (this.flushQueued) {
        this.flushQueued = false;
        void this.flush();
      }
    }
  }

  async onLastConnectionLeft(): Promise<void> {
    if (this.dirty) {
      await this.flush();
    }
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.awareness.destroy();
    this.doc.destroy();
  }
}
