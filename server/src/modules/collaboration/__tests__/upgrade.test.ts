import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { createApp } from "../../../app.js";
import { setupCollaboration } from "../index.js";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../../documents/documentRepository.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";

describe("T5.1 WebSocket Upgrade Handler (Security checks in order)", () => {
  let server: http.Server;
  let port: number;

  let ownerId: string;
  let nonMemberId: string;
  let validDocId: string;

  let validOwnerCookie: string;
  let nonMemberCookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);
    const owner = await createUser({ name: "Alice Owner", email: "alice.upgrade@example.com", password_hash: hash });
    ownerId = owner.id;

    const nonMember = await createUser({ name: "Bob NonMember", email: "bob.upgrade@example.com", password_hash: hash });
    nonMemberId = nonMember.id;

    const doc = await createDocument(ownerId, "Upgrade Test Doc");
    validDocId = doc.id;

    const ownerToken = jwt.sign({ sub: ownerId }, env.JWT_SECRET, { expiresIn: "7d" });
    validOwnerCookie = `cs_session=${ownerToken}`;

    const nonMemberToken = jwt.sign({ sub: nonMemberId }, env.JWT_SECRET, { expiresIn: "7d" });
    nonMemberCookie = `cs_session=${nonMemberToken}`;

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
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
  });

  function attemptConnect(
    path: string,
    options: {
      origin?: string | undefined;
      cookie?: string | undefined;
    } = {},
  ): Promise<{ connected: boolean; status?: number | undefined }> {
    return new Promise((resolve) => {
      const headers: Record<string, string> = {};
      if (options.origin) headers["Origin"] = options.origin;
      if (options.cookie) headers["Cookie"] = options.cookie;

      const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
        headers,
      });

      ws.on("open", () => {
        ws.close();
        resolve({ connected: true });
      });

      ws.on("unexpected-response", (_req, res) => {
        resolve({ connected: false, status: res.statusCode });
      });

      ws.on("error", () => {
        // Handled via unexpected-response
      });
    });
  }

  it("1. Rejects non-UUID documentId with 400 Bad Request", async () => {
    const res = await attemptConnect("/collab/not-a-valid-uuid", {
      origin: "http://localhost:5173",
      cookie: validOwnerCookie,
    });
    expect(res.connected).toBe(false);
    expect(res.status).toBe(400);
  });

  it("2. Rejects unauthorized origin with 403 Forbidden", async () => {
    const res = await attemptConnect(`/collab/${validDocId}`, {
      origin: "http://malicious-site.com",
      cookie: validOwnerCookie,
    });
    expect(res.connected).toBe(false);
    expect(res.status).toBe(403);
  });

  it("3. Rejects missing or invalid cookie with 401 Unauthorized", async () => {
    // Missing cookie
    const resNoCookie = await attemptConnect(`/collab/${validDocId}`, {
      origin: "http://localhost:5173",
    });
    expect(resNoCookie.connected).toBe(false);
    expect(resNoCookie.status).toBe(401);

    // Invalid JWT
    const resBadToken = await attemptConnect(`/collab/${validDocId}`, {
      origin: "http://localhost:5173",
      cookie: "cs_session=invalid.jwt.token",
    });
    expect(resBadToken.connected).toBe(false);
    expect(resBadToken.status).toBe(401);
  });

  it("4. Rejects non-existent document with 404 Not Found", async () => {
    const missingDocId = "00000000-0000-0000-0000-000000000000";
    const res = await attemptConnect(`/collab/${missingDocId}`, {
      origin: "http://localhost:5173",
      cookie: validOwnerCookie,
    });
    expect(res.connected).toBe(false);
    expect(res.status).toBe(404);
  });

  it("5. Rejects non-member with 403 Forbidden when link_access is NONE", async () => {
    const res = await attemptConnect(`/collab/${validDocId}`, {
      origin: "http://localhost:5173",
      cookie: nonMemberCookie,
    });
    expect(res.connected).toBe(false);
    expect(res.status).toBe(403);
  });

  it("6. Successfully upgrades authenticated owner (101)", async () => {
    const res = await attemptConnect(`/collab/${validDocId}`, {
      origin: "http://localhost:5173",
      cookie: validOwnerCookie,
    });
    expect(res.connected).toBe(true);
  });

  it("7. Successfully upgrades non-member when link_access is VIEWER", async () => {
    // Change link_access to VIEWER
    await pool.query("UPDATE documents SET link_access = 'VIEWER' WHERE id = $1", [validDocId]);

    const res = await attemptConnect(`/collab/${validDocId}`, {
      origin: "http://localhost:5173",
      cookie: nonMemberCookie,
    });
    expect(res.connected).toBe(true);
  });
});
