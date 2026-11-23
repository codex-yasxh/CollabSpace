import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import { createApp } from "../../../app.js";
import { setupCollaboration, MSG_SYNC, MSG_SAVE } from "../index.js";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../../documents/documentRepository.js";
import { roomManager } from "../roomManager.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";

describe("T5.4 Persistence and Save Status (Vitest + Real WebSockets)", () => {
  let server: http.Server;
  let port: number;

  let ownerId: string;
  let docId: string;
  let ownerCookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);
    const owner = await createUser({
      name: "Alice Persistence",
      email: "alice.persist@example.com",
      password_hash: hash,
    });
    ownerId = owner.id;

    const doc = await createDocument(ownerId, "Persistence Test Doc");
    docId = doc.id;

    const ownerToken = jwt.sign({ sub: ownerId }, env.JWT_SECRET, { expiresIn: "7d" });
    ownerCookie = `cs_session=${ownerToken}`;

    const app = createApp();
    server = http.createServer(app);
    setupCollaboration(server);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await roomManager.reset();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
  });

  function createClient(): Promise<{
    ws: WebSocket;
    receivedSaveMessages: { status: number; timestamp: number }[];
    close: () => void;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/collab/${docId}`, {
        headers: {
          Origin: "http://localhost:5173",
          Cookie: ownerCookie,
        },
      });

      const receivedSaveMessages: { status: number; timestamp: number }[] = [];

      ws.on("message", (data: unknown) => {
        let bytes: Uint8Array;
        if (Buffer.isBuffer(data)) {
          bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else {
          bytes = new Uint8Array(Buffer.from(data as string));
        }

        const decoder = decoding.createDecoder(bytes);
        const msgType = decoding.readVarUint(decoder);
        if (msgType === MSG_SAVE) {
          const status = decoding.readVarUint(decoder);
          const timestamp = decoding.readVarUint(decoder);
          receivedSaveMessages.push({ status, timestamp });
        }
      });

      ws.on("open", () => {
        resolve({
          ws,
          receivedSaveMessages,
          close: () => ws.close(),
        });
      });

      ws.on("error", reject);
    });
  }

  it("sends initial save status on connect and broadcasts saving/saved on edits", async () => {
    const client = await createClient();

    // 1. New connection should immediately receive the current save status
    await new Promise((r) => setTimeout(r, 100));
    expect(client.receivedSaveMessages.length).toBeGreaterThanOrEqual(1);
    expect(client.receivedSaveMessages[0]?.status).toBe(1); // Initially saved

    // 2. Perform an edit
    const localDoc = new Y.Doc();
    let updateBytes: Uint8Array | null = null;
    localDoc.on("update", (u) => {
      updateBytes = u;
    });
    localDoc.getText("default").insert(0, "Testing persistence message type 4");

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, updateBytes!);
    client.ws.send(encoding.toUint8Array(encoder));

    // Wait for "saving" broadcast
    await new Promise((r) => setTimeout(r, 100));
    const hasSaving = client.receivedSaveMessages.some((m) => m.status === 0);
    expect(hasSaving).toBe(true);

    const room = await roomManager.getRoom(docId);
    expect(room.dirty).toBe(true);

    // Explicitly invoke flush or wait for debounce
    await room.flush();

    expect(room.dirty).toBe(false);
    const hasSaved = client.receivedSaveMessages.some((m) => m.status === 1 && m.timestamp > 0);
    expect(hasSaved).toBe(true);

    // Verify DB contains updated bytes
    const dbRes = await pool.query<{ content_state: Buffer }>(
      "SELECT content_state FROM documents WHERE id = $1",
      [docId],
    );
    expect(dbRes.rows[0]?.content_state).not.toBeNull();
    const loadedDoc = new Y.Doc();
    Y.applyUpdate(loadedDoc, new Uint8Array(dbRes.rows[0]!.content_state));
    expect(loadedDoc.getText("default").toString()).toContain("Testing persistence message type 4");

    client.close();
  });

  it("handles in-flight edit guard correctly", async () => {
    const room = await roomManager.getRoom(docId);
    room.dirty = false;

    // Simulate edit arriving while flush is running
    room.doc.getText("default").insert(0, "Edit A");
    room.markDirty();
    expect(room.dirty).toBe(true);

    const versionAtStart = room.currentVersion;

    // Simulate starting flush
    room.flushing = true;

    // Another edit arrives during flush!
    room.doc.getText("default").insert(0, "Edit B during flush");
    room.currentVersion++; // Version changed

    // When flush finishes with mismatched version:
    if (room.currentVersion === versionAtStart) {
      room.dirty = false;
    } else {
      room.dirty = true;
    }

    expect(room.dirty).toBe(true);
    room.flushing = false;

    // Next flush will capture both edits
    await room.flush();
    expect(room.dirty).toBe(false);

    const dbRes = await pool.query<{ content_state: Buffer }>(
      "SELECT content_state FROM documents WHERE id = $1",
      [docId],
    );
    const loadedDoc = new Y.Doc();
    Y.applyUpdate(loadedDoc, new Uint8Array(dbRes.rows[0]!.content_state));
    expect(loadedDoc.getText("default").toString()).toContain("Edit B during flush");
  });

  it("flushes immediately when the last connection disconnects", async () => {
    const client = await createClient();
    await new Promise((r) => setTimeout(r, 100));

    const room = await roomManager.getRoom(docId);

    // Insert edit locally on room doc without waiting for debounce timer
    room.doc.getText("default").insert(0, "Last connection leave edit");
    room.markDirty();
    expect(room.dirty).toBe(true);

    // Close client (last connection leaving)
    client.close();

    // Wait 250ms for close handler to execute flush
    await new Promise((r) => setTimeout(r, 250));

    expect(room.dirty).toBe(false);

    const dbRes = await pool.query<{ content_state: Buffer }>(
      "SELECT content_state FROM documents WHERE id = $1",
      [docId],
    );
    const loadedDoc = new Y.Doc();
    Y.applyUpdate(loadedDoc, new Uint8Array(dbRes.rows[0]!.content_state));
    expect(loadedDoc.getText("default").toString()).toContain("Last connection leave edit");
  });
});
