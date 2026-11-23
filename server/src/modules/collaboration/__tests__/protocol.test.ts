import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { createApp } from "../../../app.js";
import { setupCollaboration, MSG_SYNC, MSG_AWARENESS } from "../index.js";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../../documents/documentRepository.js";
import { roomManager } from "../roomManager.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";

describe("T5.3 Protocol Handler & Viewer Filter (Vitest + Real WebSockets)", () => {
  let server: http.Server;
  let port: number;

  let ownerId: string;
  let viewerId: string;
  let docId: string;

  let ownerCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);
    const owner = await createUser({ name: "Alice Protocol", email: "alice.protocol@example.com", password_hash: hash });
    ownerId = owner.id;

    const viewer = await createUser({ name: "Bob Viewer", email: "bob.viewer@example.com", password_hash: hash });
    viewerId = viewer.id;

    // Create document
    const doc = await createDocument(ownerId, "Protocol Test Doc");
    docId = doc.id;

    // Add Bob as VIEWER
    await pool.query(
      `INSERT INTO document_members (document_id, user_id, role)
       VALUES ($1, $2, 'VIEWER')`,
      [docId, viewerId],
    );

    const ownerToken = jwt.sign({ sub: ownerId }, env.JWT_SECRET, { expiresIn: "7d" });
    ownerCookie = `cs_session=${ownerToken}`;

    const viewerToken = jwt.sign({ sub: viewerId }, env.JWT_SECRET, { expiresIn: "7d" });
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
  });

  function createClient(cookie: string): Promise<{
    ws: WebSocket;
    receivedMessages: Uint8Array[];
    close: () => void;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/collab/${docId}`, {
        headers: {
          Origin: "http://localhost:5173",
          Cookie: cookie,
        },
      });

      const receivedMessages: Uint8Array[] = [];

      ws.on("message", (data: unknown) => {
        let bytes: Uint8Array;
        if (Buffer.isBuffer(data)) {
          bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else {
          bytes = new Uint8Array(Buffer.from(data as string));
        }
        receivedMessages.push(bytes);
      });

      ws.on("open", () => {
        resolve({
          ws,
          receivedMessages,
          close: () => ws.close(),
        });
      });

      ws.on("error", reject);
    });
  }

  it("sends sync step 1 on connect and answers client step 1 with step 2", async () => {
    const client = await createClient(ownerCookie);

    // Wait for server's initial sync step 1
    await new Promise((r) => setTimeout(r, 100));
    expect(client.receivedMessages.length).toBeGreaterThanOrEqual(1);

    // Verify first message is MSG_SYNC with sub-type step 1
    const firstMsg = client.receivedMessages[0]!;
    const decoder = decoding.createDecoder(firstMsg);
    const msgType = decoding.readVarUint(decoder);
    const syncType = decoding.readVarUint(decoder);

    expect(msgType).toBe(MSG_SYNC);
    expect(syncType).toBe(syncProtocol.messageYjsSyncStep1);

    // Client answers by sending sync step 1 to request server's step 2
    const clientDoc = new Y.Doc();
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, clientDoc);
    client.ws.send(encoding.toUint8Array(encoder));

    // Wait for server's response
    await new Promise((r) => setTimeout(r, 100));

    // Verify server answered with sync step 2
    const hasStep2 = client.receivedMessages.some((msg) => {
      const dec = decoding.createDecoder(msg);
      if (decoding.readVarUint(dec) === MSG_SYNC) {
        return decoding.readVarUint(dec) === syncProtocol.messageYjsSyncStep2;
      }
      return false;
    });
    expect(hasStep2).toBe(true);

    client.close();
  });

  it("applies owner/editor updates and broadcasts to other connections", async () => {
    const ownerClient = await createClient(ownerCookie);
    const viewerClient = await createClient(viewerCookie);

    await new Promise((r) => setTimeout(r, 100));

    // Clear received messages
    ownerClient.receivedMessages.length = 0;
    viewerClient.receivedMessages.length = 0;

    // Owner creates an edit in a local Y.Doc and sends update to server
    const localDoc = new Y.Doc();
    let editBytes: Uint8Array | null = null;
    localDoc.on("update", (u) => {
      editBytes = u;
    });
    localDoc.getText("default").insert(0, "Collaborative edit by Owner");

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, editBytes!);
    ownerClient.ws.send(encoding.toUint8Array(encoder));

    // Wait for broadcast
    await new Promise((r) => setTimeout(r, 150));

    // Viewer should have received the broadcast update message
    const viewerGotUpdate = viewerClient.receivedMessages.some((msg) => {
      const dec = decoding.createDecoder(msg);
      if (decoding.readVarUint(dec) === MSG_SYNC) {
        return decoding.readVarUint(dec) === syncProtocol.messageYjsUpdate;
      }
      return false;
    });
    expect(viewerGotUpdate).toBe(true);

    // Server Y.Doc must contain the text
    const room = await roomManager.getRoom(docId);
    expect(room.doc.getText("default").toString()).toContain("Collaborative edit by Owner");

    ownerClient.close();
    viewerClient.close();
  });

  it("Viewer write filter drops Viewer updates silently without throwing", async () => {
    const ownerClient = await createClient(ownerCookie);
    const viewerClient = await createClient(viewerCookie);

    await new Promise((r) => setTimeout(r, 100));

    ownerClient.receivedMessages.length = 0;
    viewerClient.receivedMessages.length = 0;

    const room = await roomManager.getRoom(docId);
    const initialText = room.doc.getText("default").toString();

    // Viewer forges a direct update packet
    const forgedDoc = new Y.Doc();
    let forgedUpdate: Uint8Array | null = null;
    forgedDoc.on("update", (u) => {
      forgedUpdate = u;
    });
    forgedDoc.getText("default").insert(0, "HACKED_BY_VIEWER");

    // Viewer sends update message (sync sub-type 2)
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, forgedUpdate!);
    viewerClient.ws.send(encoding.toUint8Array(encoder));

    // Wait 200ms
    await new Promise((r) => setTimeout(r, 200));

    // 1. Server Y.Doc text is unchanged!
    expect(room.doc.getText("default").toString()).toBe(initialText);
    expect(room.doc.getText("default").toString()).not.toContain("HACKED_BY_VIEWER");

    // 2. Owner received NO updates from Viewer
    const ownerGotUpdate = ownerClient.receivedMessages.some((msg) => {
      const dec = decoding.createDecoder(msg);
      if (decoding.readVarUint(dec) === MSG_SYNC) {
        return decoding.readVarUint(dec) === syncProtocol.messageYjsUpdate;
      }
      return false;
    });
    expect(ownerGotUpdate).toBe(false);

    // 3. Viewer connection was NOT crashed/thrown: socket is still open
    expect(viewerClient.ws.readyState).toBe(WebSocket.OPEN);

    ownerClient.close();
    viewerClient.close();
  });

  it("broadcasts awareness and cleans up states on disconnect", async () => {
    const clientA = await createClient(ownerCookie);
    const clientB = await createClient(viewerCookie);

    await new Promise((r) => setTimeout(r, 100));
    clientB.receivedMessages.length = 0;

    // Client A sends an awareness update
    const awA = new awarenessProtocol.Awareness(new Y.Doc());
    awA.setLocalStateField("user", { name: "Alice A" });
    const awUpdate = awarenessProtocol.encodeAwarenessUpdate(awA, [awA.clientID]);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, awUpdate);
    clientA.ws.send(encoding.toUint8Array(encoder));

    await new Promise((r) => setTimeout(r, 150));

    // Client B received the awareness update
    const bGotAwareness = clientB.receivedMessages.some((msg) => {
      const dec = decoding.createDecoder(msg);
      return decoding.readVarUint(dec) === MSG_AWARENESS;
    });
    expect(bGotAwareness).toBe(true);

    const room = await roomManager.getRoom(docId);
    expect(room.awareness.getStates().has(awA.clientID)).toBe(true);

    // When client A closes, its awareness state is cleaned up
    clientA.close();
    await new Promise((r) => setTimeout(r, 150));
    expect(room.awareness.getStates().has(awA.clientID)).toBe(false);

    clientB.close();
  });

  it("handles malformed packet by closing that connection with 1003 without crashing server", async () => {
    const client = await createClient(ownerCookie);

    let closeCode: number | null = null;
    client.ws.on("close", (code) => {
      closeCode = code;
    });

    // Send garbage non-lib0 bytes
    client.ws.send(Buffer.from([0xff, 0xff, 0xff, 0xff]));

    await new Promise((r) => setTimeout(r, 150));

    expect(closeCode).toBe(1003);

    // Server is still alive and responds to new clients
    const newClient = await createClient(ownerCookie);
    expect(newClient.ws.readyState).toBe(WebSocket.OPEN);
    newClient.close();
  });
});
