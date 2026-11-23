import { Room } from "./room.js";

export class RoomManager {
  private rooms = new Map<string, Promise<Room>>();

  /**
   * Returns existing loading promise or initiates single DB load.
   * Stored synchronously in map so concurrent cold opens share one load.
   */
  getRoom(docId: string): Promise<Room> {
    let p = this.rooms.get(docId);
    if (!p) {
      p = Room.load(docId).catch((err) => {
        this.rooms.delete(docId);
        throw err;
      });
      this.rooms.set(docId, p);
    }
    return p;
  }

  hasRoom(docId: string): boolean {
    return this.rooms.has(docId);
  }

  deleteRoom(docId: string): void {
    this.rooms.delete(docId);
  }

  getLoadedRoom(docId: string): Room | null {
    const p = this.rooms.get(docId);
    if (!p) return null;
    // Inspect if resolved without blocking
    // Return null if still loading
    return null;
  }

  /**
   * Closes all connections for a document with specific code (e.g. 4403 on permission revocation).
   */
  async closeAllConnections(docId: string, code: number = 4403, reason: string = "Access changed"): Promise<void> {
    const p = this.rooms.get(docId);
    if (!p) return;
    try {
      const room = await p;
      for (const conn of Array.from(room.conns)) {
        try {
          conn.ws.close(code, reason);
        } catch {
          // ignore
        }
      }
    } catch {
      // Room failed to load
    }
  }

  /**
   * Evicts a room on document deletion without flushing to DB.
   * Cancels timer so nothing writes to deleted row.
   */
  async evictRoomOnDelete(docId: string): Promise<void> {
    const p = this.rooms.get(docId);
    if (!p) return;
    this.rooms.delete(docId);
    try {
      const room = await p;
      if (room.timer) {
        clearTimeout(room.timer);
        room.timer = null;
      }
      room.dirty = false;
      for (const conn of Array.from(room.conns)) {
        try {
          conn.ws.close(4404, "Document deleted");
        } catch {
          // ignore
        }
      }
      room.destroy();
    } catch {
      // Room load failed
    }
  }

  /**
   * Flushes all active dirty rooms to database (e.g. on SIGTERM/SIGINT shutdown).
   */
  async flushAllRooms(): Promise<void> {
    const promises = Array.from(this.rooms.values());
    await Promise.allSettled(
      promises.map(async (p) => {
        try {
          const room = await p;
          if (room.dirty) {
            await room.flush();
          }
        } catch {
          // ignore
        }
      }),
    );
  }

  /**
   * Resets all rooms (for testing or shutdown).
   */
  async reset(): Promise<void> {
    const promises = Array.from(this.rooms.values());
    this.rooms.clear();
    for (const p of promises) {
      try {
        const room = await p;
        if (room.timer) {
          clearTimeout(room.timer);
          room.timer = null;
        }
        room.destroy();
      } catch {
        // ignore
      }
    }
  }
}

export const roomManager = new RoomManager();
