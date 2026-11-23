import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import type { WebSocket } from "ws";
import type { User } from "../users/userRepository.js";
import type { DocumentRole } from "../access/resolveRole.js";
import { query } from "../../database/db.js";

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
  // Tracking edits during flush
  flushVersion: number = 0;
  currentVersion: number = 0;

  constructor(id: string, doc: Y.Doc, awareness: awarenessProtocol.Awareness) {
    this.id = id;
    this.doc = doc;
    this.awareness = awareness;
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

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.awareness.destroy();
    this.doc.destroy();
  }
}
