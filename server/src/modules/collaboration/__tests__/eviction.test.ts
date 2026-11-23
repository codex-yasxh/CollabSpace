import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import request from "supertest";
import { createApp } from "../../../app.js";
import { setupCollaboration } from "../index.js";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../../documents/documentRepository.js";
import { signToken } from "../../auth/authService.js";
import { roomManager } from "../roomManager.js";
import bcrypt from "bcryptjs";

describe("T5.5 Close & Eviction on Role Change and Document Delete", () => {
  let app: ReturnType<typeof createApp>;
  let server: http.Server;
  let port: number;

  let ownerId: string;
  let editorId: string;
  let docId: string;

  let ownerCookie: string;
  let editorCookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);
    const owner = await createUser({
      name: "Owner Eviction",
      email: "owner.eviction@example.com",
      password_hash: hash,
    });
    ownerId = owner.id;

    const editor = await createUser({
      name: "Editor Eviction",
      email: "editor.eviction@example.com",
      password_hash: hash,
    });
    editorId = editor.id;

    const doc = await createDocument(ownerId, "Eviction Test Doc");
    docId = doc.id;

    // Add editor as member
    await pool.query(
      `INSERT INTO document_members (document_id, user_id, role)
       VALUES ($1, $2, 'EDITOR')`,
      [docId, editorId],
    );

    const ownerToken = signToken({ sub: ownerId });
    ownerCookie = `cs_session=${ownerToken}`;

    const editorToken = signToken({ sub: editorId });
    editorCookie = `cs_session=${editorToken}`;

    app = createApp();
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
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
  });

  function connectClient(cookie: string): Promise<{ ws: WebSocket; closePromise: Promise<number> }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/collab/${docId}`, {
        headers: {
          Origin: "http://localhost:5173",
          Cookie: cookie,
        },
      });

      const closePromise = new Promise<number>((res) => {
        ws.on("close", (code) => res(code));
      });

      ws.on("open", () => resolve({ ws, closePromise }));
      ws.on("error", reject);
    });
  }

  it("closes live connections with code 4403 when permissions are modified or revoked", async () => {
    const { ws, closePromise } = await connectClient(editorCookie);
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Call member removal API as Owner
    const res = await request(app)
      .delete(`/api/documents/${docId}/members/${editorId}`)
      .set("Cookie", ownerCookie);

    expect(res.status).toBe(200);

    // Socket should close with code 4403
    const code = await closePromise;
    expect(code).toBe(4403);

    // Reconnecting as the removed user is rejected with 403 Forbidden
    const reconnectAttempt = await new Promise<number>((resolve) => {
      const rws = new WebSocket(`ws://127.0.0.1:${port}/collab/${docId}`, {
        headers: {
          Origin: "http://localhost:5173",
          Cookie: editorCookie,
        },
      });
      rws.on("unexpected-response", (_req, resp) => {
        resolve(resp.statusCode ?? 0);
      });
      rws.on("open", () => {
        rws.close();
        resolve(200);
      });
    });

    expect(reconnectAttempt).toBe(403);
  });

  it("evicts room with code 4404 on document delete without writing to deleted row", async () => {
    // Re-create a fresh document for delete testing
    const docToDelete = await createDocument(ownerId, "Doc To Delete");
    const testDocId = docToDelete.id;

    // Connect owner to room
    const ws = new WebSocket(`ws://127.0.0.1:${port}/collab/${testDocId}`, {
      headers: {
        Origin: "http://localhost:5173",
        Cookie: ownerCookie,
      },
    });

    const closePromise = new Promise<number>((res) => {
      ws.on("close", (code) => res(code));
    });

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });

    // Mark dirty in room
    const room = await roomManager.getRoom(testDocId);
    room.doc.getText("default").insert(0, "Unsaved changes before delete");
    room.markDirty();
    expect(room.dirty).toBe(true);

    // Call DELETE /api/documents/:id as Owner
    const delRes = await request(app)
      .delete(`/api/documents/${testDocId}`)
      .set("Cookie", ownerCookie);

    expect(delRes.status).toBe(200);

    // Socket closed with code 4404
    const code = await closePromise;
    expect(code).toBe(4404);

    // Room is evicted from roomManager
    expect(roomManager.hasRoom(testDocId)).toBe(false);

    // Reconnection is rejected with 404
    const reconnectAttempt = await new Promise<number>((resolve) => {
      const rws = new WebSocket(`ws://127.0.0.1:${port}/collab/${testDocId}`, {
        headers: {
          Origin: "http://localhost:5173",
          Cookie: ownerCookie,
        },
      });
      rws.on("unexpected-response", (_req, resp) => {
        resolve(resp.statusCode ?? 0);
      });
      rws.on("open", () => {
        rws.close();
        resolve(200);
      });
    });

    expect(reconnectAttempt).toBe(404);
  });
});
