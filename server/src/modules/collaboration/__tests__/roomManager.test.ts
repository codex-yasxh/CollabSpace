import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as Y from "yjs";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../../documents/documentRepository.js";
import { RoomManager } from "../roomManager.js";
import bcrypt from "bcryptjs";

describe("T5.2 Room Manager (Single DB load & Y.Doc initialization)", () => {
  let ownerId: string;
  let docId: string;
  let manager: RoomManager;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);
    const owner = await createUser({ name: "Alice Room", email: "alice.room@example.com", password_hash: hash });
    ownerId = owner.id;

    // Create an initial Y.Doc with text content and encode it to bytea
    const initialDoc = new Y.Doc();
    const ytext = initialDoc.getText("default");
    ytext.insert(0, "Initial collaborative text");
    const update = Y.encodeStateAsUpdate(initialDoc);

    const doc = await createDocument(ownerId, "Room Manager Test Doc");
    docId = doc.id;

    // Save initial content_state into database
    await pool.query("UPDATE documents SET content_state = $1 WHERE id = $2", [
      Buffer.from(update),
      docId,
    ]);

    manager = new RoomManager();
  });

  afterAll(async () => {
    await manager.reset();
    await closePool();
  });

  it("loads content_state from database into Y.Doc", async () => {
    const room = await manager.getRoom(docId);
    expect(room.id).toBe(docId);
    expect(room.doc).toBeInstanceOf(Y.Doc);

    const text = room.doc.getText("default").toString();
    expect(text).toBe("Initial collaborative text");
  });

  it("deduplicates concurrent cold opens into exactly one database load", async () => {
    const freshManager = new RoomManager();

    // Track DB query count
    let queryCount = 0;
    const originalQuery = pool.query.bind(pool);
    pool.query = (async (...args: Parameters<typeof pool.query>) => {
      const sql = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string }).text;
      if (sql && sql.includes("SELECT content_state FROM documents")) {
        queryCount++;
      }
      return (originalQuery as (...a: unknown[]) => unknown)(...args);
    }) as typeof pool.query;

    try {
      // 10 concurrent requests for the same room
      const promises = Array.from({ length: 10 }, () => freshManager.getRoom(docId));
      const rooms = await Promise.all(promises);

      // All 10 returned identical room instance
      for (const r of rooms) {
        expect(r).toBe(rooms[0]);
      }

      // Exactly 1 DB query was executed
      expect(queryCount).toBe(1);
    } finally {
      pool.query = originalQuery;
      await freshManager.reset();
    }
  });

  it("removes failed promise from map if document does not exist", async () => {
    const missingDocId = "00000000-0000-0000-0000-000000000000";
    await expect(manager.getRoom(missingDocId)).rejects.toThrow("not found");
    expect(manager.hasRoom(missingDocId)).toBe(false);
  });
});
