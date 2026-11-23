import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import { createApp } from "../../../app.js";
import { setupCollaboration } from "../index.js";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../../documents/documentRepository.js";
import { addDocumentMember } from "../../documents/memberRepository.js";
import { signToken } from "../../auth/authService.js";
import { roomManager } from "../roomManager.js";
import { TestClient, waitFor } from "./helpers/testClient.js";

describe("T7.1 Reconnection & Offline Convergence Test Suite", () => {
  let server: http.Server;
  let port: number;

  let ownerId: string;
  let editorId: string;

  let ownerCookie: string;
  let editorCookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);

    const owner = await createUser({
      name: "Alice Owner",
      email: "alice.reconnect@example.com",
      password_hash: hash,
    });
    ownerId = owner.id;

    const editor = await createUser({
      name: "Bob Editor",
      email: "bob.reconnect@example.com",
      password_hash: hash,
    });
    editorId = editor.id;

    ownerCookie = `cs_session=${signToken({ sub: ownerId })}`;
    editorCookie = `cs_session=${signToken({ sub: editorId })}`;

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
    await roomManager.flushAllRooms();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await closePool();
  });

  it("converges without data loss when one client edits offline, both edit concurrently, and reconnects", async () => {
    const doc = await createDocument(
      ownerId,
      "Offline Convergence Doc",
    );
    const docId = doc.id;

    await addDocumentMember(docId, editorId, "EDITOR");

    const url = `ws://127.0.0.1:${port}/collab/${docId}`;

    // 1. Connect Client A (Owner) and Client B (Editor)
    const clientA = await TestClient.connect({
      url,
      cookie: ownerCookie,
    });

    const clientB = await TestClient.connect({
      url,
      cookie: editorCookie,
    });

    // Initial base text from Client A
    clientA.doc.getText("default").insert(0, "Base text.");
    await waitFor(
      () => clientB.doc.getText("default").toString() === "Base text.",
      5000,
      25,
      "Client B receives base text",
    );

    // 2. Take Client B offline (simulate DevTools offline / network disconnect)
    clientB.ws.close();
    await waitFor(() => !clientB.isConnected, 5000, 25, "Client B is disconnected");

    // 3. Concurrent edits while Client B is offline:
    // Client A makes an online edit
    clientA.doc.getText("default").insert(10, " [Online A]");

    // Client B makes an offline edit into its local Y.Doc
    clientB.doc.getText("default").insert(0, "[Offline B] ");

    // Verify local states diverged
    expect(clientA.doc.getText("default").toString()).toBe("Base text. [Online A]");
    expect(clientB.doc.getText("default").toString()).toBe("[Offline B] Base text.");

    // 4. Reconnect Client B to the server with its mutated offline doc
    await clientB.open({
      url,
      cookie: editorCookie,
    });
    await waitFor(() => clientB.isConnected, 5000, 25, "Client B reconnected");

    // 5. Verify both clients converge to the exact same state without data loss
    await waitFor(
      () =>
        clientA.doc.getText("default").toString() ===
        clientB.doc.getText("default").toString(),
      5000,
      25,
      "Client A and Client B converge",
    );

    const convergedText = clientA.doc.getText("default").toString();
    expect(convergedText).toContain("[Offline B]");
    expect(convergedText).toContain("Base text.");
    expect(convergedText).toContain("[Online A]");
    expect(clientB.doc.getText("default").toString()).toBe(convergedText);

    // Verify server room also has the exact converged state
    const room = await roomManager.getRoom(docId);
    expect(room.doc.getText("default").toString()).toBe(convergedText);

    // Clean up connections
    clientA.close();
    clientB.close();
  });

  it("converges deterministically when both clients insert at the exact same position offline", async () => {
    const doc = await createDocument(ownerId, "Conflict Convergence Doc");
    const docId = doc.id;
    await addDocumentMember(docId, editorId, "EDITOR");

    const url = `ws://127.0.0.1:${port}/collab/${docId}`;

    const clientA = await TestClient.connect({ url, cookie: ownerCookie });
    const clientB = await TestClient.connect({ url, cookie: editorCookie });

    clientA.doc.getText("default").insert(0, "Start-End");
    await waitFor(
      () => clientB.doc.getText("default").toString() === "Start-End",
      5000,
      25,
      "Synced Start-End",
    );

    // Client B goes offline
    clientB.ws.close();
    await waitFor(() => !clientB.isConnected, 5000, 25, "Client B offline");

    // Both insert at index 5 (between 'Start' and '-End')
    clientA.doc.getText("default").insert(5, "[A]");
    clientB.doc.getText("default").insert(5, "[B]");

    // Client B reconnects
    await clientB.open({ url, cookie: editorCookie });
    await waitFor(() => clientB.isConnected, 5000, 25, "Client B reconnected");

    // Both converge
    await waitFor(
      () =>
        clientA.doc.getText("default").toString() ===
        clientB.doc.getText("default").toString(),
      5000,
      25,
      "Both converge on identical string",
    );

    const result = clientA.doc.getText("default").toString();
    expect(result).toContain("[A]");
    expect(result).toContain("[B]");
    expect(clientB.doc.getText("default").toString()).toBe(result);

    clientA.close();
    clientB.close();
  });
});
