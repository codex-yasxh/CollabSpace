import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import { WebsocketProvider } from "y-websocket";
import { createApp } from "../../../app.js";
import { setupCollaboration, rooms } from "../index.js";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../../documents/documentRepository.js";
import { signToken } from "../../auth/authService.js";
import { roomManager } from "../roomManager.js";
import bcrypt from "bcryptjs";
import { TestClient, waitFor } from "./helpers/testClient.js";

describe("T5.6 Collaboration Sync Server Integration Test Suite", () => {
  let server: http.Server;
  let port: number;

  let ownerId: string;
  let editorId: string;
  let viewerId: string;

  let ownerCookie: string;
  let editorCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);

    const owner = await createUser({
      name: "Owner Integration",
      email: "owner.integ@example.com",
      password_hash: hash,
    });
    ownerId = owner.id;

    const editor = await createUser({
      name: "Editor Integration",
      email: "editor.integ@example.com",
      password_hash: hash,
    });
    editorId = editor.id;

    const viewer = await createUser({
      name: "Viewer Integration",
      email: "viewer.integ@example.com",
      password_hash: hash,
    });
    viewerId = viewer.id;

    const ownerToken = signToken({ sub: ownerId });
    ownerCookie = `cs_session=${ownerToken}`;

    const editorToken = signToken({ sub: editorId });
    editorCookie = `cs_session=${editorToken}`;

    const viewerToken = signToken({ sub: viewerId });
    viewerCookie = `cs_session=${viewerToken}`;

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
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await Promise.race([
      new Promise<void>((resolve) => server.close(() => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
    await closePool();
  });

  /**
   * Helper to create a document and optionally add members.
   */
  async function setupDoc(title: string, addEditor = true, addViewer = true): Promise<string> {
    const doc = await createDocument(ownerId, title);
    if (addEditor) {
      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role) VALUES ($1, $2, 'EDITOR')`,
        [doc.id, editorId],
      );
    }
    if (addViewer) {
      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role) VALUES ($1, $2, 'VIEWER')`,
        [doc.id, viewerId],
      );
    }
    return doc.id;
  }

  // Scenario (a): Two clients converge on identical text
  it("(a) two clients converge: concurrent edits merge cleanly and both Y.Docs reach identical content", async () => {
    const docId = await setupDoc("Convergence Test Doc");

    const clientA = await TestClient.connect({
      url: `ws://127.0.0.1:${port}/collab/${docId}`,
      cookie: ownerCookie,
    });

    const clientB = await TestClient.connect({
      url: `ws://127.0.0.1:${port}/collab/${docId}`,
      cookie: editorCookie,
    });

    // Client A inserts text
    clientA.insertText(0, "Alpha ");
    // Client B inserts text
    clientB.insertText(0, "Beta ");

    // Wait until both clients converge to identical string content
    await waitFor(
      () => clientA.getText().length > 0 && clientA.getText() === clientB.getText(),
      5000,
      25,
      "clients A and B convergence",
    );

    const merged = clientA.getText();
    expect(merged).toContain("Alpha ");
    expect(merged).toContain("Beta ");
    expect(clientB.getText()).toBe(merged);

    // Verify room doc also has converged content
    const room = await roomManager.getRoom(docId);
    expect(room.doc.getText("default").toString()).toBe(merged);

    clientA.destroy();
    clientB.destroy();
  });

  // Scenario (b): Viewer write dropped with server and Editor doc unchanged and Viewer still receiving content
  it("(b) Viewer write dropped: server and Editor docs unchanged, and Viewer still receives incoming edits", async () => {
    const docId = await setupDoc("Viewer Filter Test Doc");

    const editorClient = await TestClient.connect({
      url: `ws://127.0.0.1:${port}/collab/${docId}`,
      cookie: editorCookie,
    });

    const viewerClient = await TestClient.connect({
      url: `ws://127.0.0.1:${port}/collab/${docId}`,
      cookie: viewerCookie,
    });

    // Initial legitimate content
    editorClient.insertText(0, "Initial legitimate text. ");
    await waitFor(
      () => viewerClient.getText().includes("Initial legitimate text. "),
      5000,
      25,
      "viewer receives initial text",
    );

    const initialText = editorClient.getText();

    // Viewer crafts a forged update and attempts to force send it
    const forgedDoc = new Y.Doc();
    let forgedBytes: Uint8Array | null = null;
    forgedDoc.on("update", (u) => {
      forgedBytes = u;
    });
    forgedDoc.getText("default").insert(0, "MALICIOUS_VIEWER_OVERWRITE ");

    viewerClient.forceSendUpdate(forgedBytes!);

    // Give server time to process packet
    await new Promise((r) => setTimeout(r, 200));

    // 1. Editor doc must NOT contain the malicious text
    expect(editorClient.getText()).toBe(initialText);
    expect(editorClient.getText()).not.toContain("MALICIOUS_VIEWER_OVERWRITE");

    // 2. Server room doc must NOT contain the malicious text
    const room = await roomManager.getRoom(docId);
    expect(room.doc.getText("default").toString()).toBe(initialText);

    // 3. Viewer connection was not closed; socket is still open
    expect(viewerClient.ws.readyState).toBe(WebSocket.OPEN);

    // 4. Editor makes another legitimate edit; Viewer MUST still receive it
    editorClient.insertText(editorClient.getText().length, "Second legitimate edit.");
    await waitFor(
      () => viewerClient.getText().includes("Second legitimate edit."),
      5000,
      25,
      "viewer receives second legitimate edit",
    );

    expect(viewerClient.getText()).toContain("Second legitimate edit.");

    editorClient.destroy();
    viewerClient.destroy();
  });

  // Scenario (c): Persistence across restart with room manager reset
  it(
    "(c) persistence across restart: roomManager reset forces cold DB load preserving document state",
    async () => {
      const docId = await setupDoc("Persistence Across Restart Doc");

      const client1 = await TestClient.connect({
        url: `ws://127.0.0.1:${port}/collab/${docId}`,
        cookie: ownerCookie,
      });

      client1.insertText(0, "Data that must survive a server restart.");

      const room = await roomManager.getRoom(docId);
      // Wait until server room receives the edit from client1
      await waitFor(
        () => room.doc.getText("default").toString().includes("Data that must survive"),
        3000,
        25,
        "server room receives edit from client1",
      );

      // Flush room to DB
      await room.flush();
      expect(room.dirty).toBe(false);

      // Verify DB received the bytes
      const dbRes = await pool.query<{ content_state: Buffer }>(
        "SELECT content_state FROM documents WHERE id = $1",
        [docId],
      );
      expect(dbRes.rows[0]?.content_state).not.toBeNull();

      // Disconnect client 1
      client1.destroy();

      // Simulate complete server restart / room manager reset
      await roomManager.reset();
      expect(roomManager.hasRoom(docId)).toBe(false);

      // Connect a new client (cold open from database)
      const client2 = await TestClient.connect({
        url: `ws://127.0.0.1:${port}/collab/${docId}`,
        cookie: ownerCookie,
      });

      // Wait until client 2 receives the document state from DB
      await waitFor(
        () => client2.getText().includes("Data that must survive a server restart."),
        5000,
        25,
        "client2 loads persisted data after restart",
      );

      expect(client2.getText()).toBe("Data that must survive a server restart.");
      client2.destroy();
    },
    10000,
  );

  // Scenario (d): closeAllConnections closes socket with 4403, and reconnect rejected with 403
  it("(d) closeAllConnections closes live socket with 4403 and subsequent reconnect is rejected with 403", async () => {
    const docId = await setupDoc("Eviction Reconnect Doc");

    const client = await TestClient.connect({
      url: `ws://127.0.0.1:${port}/collab/${docId}`,
      cookie: editorCookie,
    });

    expect(client.isConnected).toBe(true);

    // Revoke access from DB
    await pool.query(`DELETE FROM document_members WHERE document_id = $1 AND user_id = $2`, [
      docId,
      editorId,
    ]);

    // Close connections with 4403
    rooms.closeAllConnections(docId, 4403, "Access revoked");

    // Wait for client to detect socket close
    await waitFor(() => client.closeCode !== null, 5000, 25, "socket closed with 4403");
    expect(client.closeCode).toBe(4403);

    // Reconnecting after role is revoked must be rejected with HTTP 403 before upgrade
    const reconnectStatus = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/collab/${docId}`, {
        headers: {
          Origin: "http://localhost:5173",
          Cookie: editorCookie,
        },
      });

      ws.on("unexpected-response", (_req, res) => {
        resolve(res.statusCode ?? 0);
      });

      ws.on("open", () => {
        ws.close();
        resolve(200);
      });

      ws.on("error", () => {
        // In case socket closed abruptly
      });
    });

    expect(reconnectStatus).toBe(403);
    client.destroy();
  });

  // Scenario (e): Compatibility test using real y-websocket WebsocketProvider
  it("(e) y-websocket compatibility: official WebsocketProvider connects and syncs bidirectionally", async () => {
    const docId = await setupDoc("Y-Websocket Compatibility Doc");

    // Custom WebSocket polyfill that injects Origin and Cookie headers
    class CustomWebSocket extends WebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, {
          headers: {
            Origin: "http://localhost:5173",
            Cookie: ownerCookie,
          },
        });
      }
    }

    const ydoc = new Y.Doc();
    // Instantiate real y-websocket WebsocketProvider
    const provider = new WebsocketProvider(
      `ws://127.0.0.1:${port}/collab`,
      docId,
      ydoc,
      {
        // Pass custom WebSocket polyfill
        WebSocketPolyfill: CustomWebSocket as unknown as typeof globalThis.WebSocket,
        connect: true,
      },
    );

    // Register message handler 4 (save status) on the WebsocketProvider
    provider.messageHandlers[4] = (_encoder, decoder) => {
      decoding.readVarUint(decoder);
      decoding.readVarUint(decoder);
    };

    // Wait for y-websocket provider to sync
    await waitFor(
      () => provider.synced === true,
      5000,
      25,
      "y-websocket provider synced",
    );

    // 1. Edit via the y-websocket provider
    ydoc.getText("default").insert(0, "Hello from real y-websocket WebsocketProvider!");

    // Verify server room receives the edit
    const room = await roomManager.getRoom(docId);
    await waitFor(
      () => room.doc.getText("default").toString().includes("Hello from real y-websocket"),
      5000,
      25,
      "room receives y-websocket edit",
    );

    // 2. Connect a second standard TestClient and verify it receives the edit from the provider
    const secondClient = await TestClient.connect({
      url: `ws://127.0.0.1:${port}/collab/${docId}`,
      cookie: editorCookie,
    });

    await waitFor(
      () => secondClient.getText().includes("Hello from real y-websocket"),
      5000,
      25,
      "second client receives edit from y-websocket",
    );

    // 3. Edit from second client and verify y-websocket provider receives it
    secondClient.insertText(secondClient.getText().length, " Reply from Editor.");
    await waitFor(
      () => ydoc.getText("default").toString().includes("Reply from Editor."),
      5000,
      25,
      "y-websocket provider receives edit from second client",
    );

    expect(ydoc.getText("default").toString()).toBe(
      "Hello from real y-websocket WebsocketProvider! Reply from Editor.",
    );

    secondClient.destroy();
    provider.destroy();
    ydoc.destroy();
  });
});
