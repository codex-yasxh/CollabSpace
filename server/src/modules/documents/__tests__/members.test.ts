import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../../app.js";
import { pool, closePool } from "../../../database/db.js";
import { createUser } from "../../users/userRepository.js";
import { createDocument } from "../documentRepository.js";
import { rooms } from "../../collaboration/rooms.js";
import bcrypt from "bcryptjs";

describe("Document Member Endpoints (T4.1 & Section 6 REST contract)", () => {
  const app = createApp();

  let ownerCookie: string;
  let ownerId: string;

  let editorCookie: string;
  let editorId: string;

  let viewerCookie: string;
  let viewerId: string;

  let nonMemberCookie: string;
  let nonMemberId: string;

  let testDocId: string;
  let closeConnectionsSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    closeConnectionsSpy = vi.spyOn(rooms, "closeAllConnections");

    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    const hash = await bcrypt.hash("password123", 10);

    const owner = await createUser({ name: "Alice Owner", email: "alice.owner@example.com", password_hash: hash });
    ownerId = owner.id;

    const editor = await createUser({ name: "Bob Editor", email: "bob.editor@example.com", password_hash: hash });
    editorId = editor.id;

    const viewer = await createUser({ name: "Carol Viewer", email: "carol.viewer@example.com", password_hash: hash });
    viewerId = viewer.id;

    const nonMember = await createUser({ name: "Dave NonMember", email: "dave.nonmember@example.com", password_hash: hash });
    nonMemberId = nonMember.id;

    // Log each in to acquire cookies
    const loginUser = async (email: string) => {
      const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
      const cookieHeader = res.headers["set-cookie"];
      return Array.isArray(cookieHeader) ? cookieHeader[0]! : (cookieHeader as unknown as string);
    };

    ownerCookie = await loginUser("alice.owner@example.com");
    editorCookie = await loginUser("bob.editor@example.com");
    viewerCookie = await loginUser("carol.viewer@example.com");
    nonMemberCookie = await loginUser("dave.nonmember@example.com");

    // Create a shared test document
    const doc = await createDocument(ownerId, "Shared Blueprint Doc");
    testDocId = doc.id;

    // Add Bob as EDITOR and Carol as VIEWER initially
    await pool.query(
      `INSERT INTO document_members (document_id, user_id, role)
       VALUES ($1, $2, 'EDITOR'), ($1, $3, 'VIEWER')`,
      [testDocId, editorId, viewerId],
    );
  });

  afterAll(async () => {
    closeConnectionsSpy.mockRestore();
    await closePool();
  });

  describe("GET /api/documents/:id/members", () => {
    it("allows owner to list members", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/members`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.members)).toBe(true);
      expect(res.body.members.length).toBe(3);
      // Owner is sorted first
      expect(res.body.members[0].role).toBe("OWNER");
      expect(res.body.members[0].email).toBe("alice.owner@example.com");
    });

    it("allows editor to list members", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/members`)
        .set("Cookie", editorCookie);

      expect(res.status).toBe(200);
      expect(res.body.members.length).toBe(3);
    });

    it("allows viewer to list members", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/members`)
        .set("Cookie", viewerCookie);

      expect(res.status).toBe(200);
      expect(res.body.members.length).toBe(3);
    });

    it("rejects non-members when link_access is NONE (403)", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/members`)
        .set("Cookie", nonMemberCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/documents/:id/members", () => {
    it("allows owner to invite a new member as EDITOR or VIEWER", async () => {
      closeConnectionsSpy.mockClear();

      // Create an invitee
      const hash = await bcrypt.hash("password123", 10);
      await createUser({ name: "Eve Invitee", email: "eve.invitee@example.com", password_hash: hash });

      const res = await request(app)
        .post(`/api/documents/${testDocId}/members`)
        .set("Cookie", ownerCookie)
        .send({ email: "EVE.INVITEE@EXAMPLE.COM", role: "VIEWER" }); // case-insensitive email test

      expect(res.status).toBe(201);
      expect(res.body.member.email).toBe("eve.invitee@example.com");
      expect(res.body.member.role).toBe("VIEWER");

      // Verify rooms.closeAllConnections was called
      expect(closeConnectionsSpy).toHaveBeenCalledWith(testDocId);
    });

    it("returns 404 with exact blueprint 4.9 copy for unknown email", async () => {
      const res = await request(app)
        .post(`/api/documents/${testDocId}/members`)
        .set("Cookie", ownerCookie)
        .send({ email: "unknown.user.999@example.com", role: "VIEWER" });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe("No account uses that email. Ask them to sign up first.");
    });

    it("returns 409 when user is already a collaborator", async () => {
      const res = await request(app)
        .post(`/api/documents/${testDocId}/members`)
        .set("Cookie", ownerCookie)
        .send({ email: "bob.editor@example.com", role: "EDITOR" });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("User is already a collaborator on this document.");
    });

    it("rejects non-owner attempts to invite members (403)", async () => {
      const res = await request(app)
        .post(`/api/documents/${testDocId}/members`)
        .set("Cookie", editorCookie)
        .send({ email: "dave.nonmember@example.com", role: "VIEWER" });

      expect(res.status).toBe(403);
    });

    it("rejects invalid role like OWNER via zod schema (400)", async () => {
      const res = await request(app)
        .post(`/api/documents/${testDocId}/members`)
        .set("Cookie", ownerCookie)
        .send({ email: "dave.nonmember@example.com", role: "OWNER" });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/documents/:id/members/:userId", () => {
    it("allows owner to update member role from VIEWER to EDITOR", async () => {
      closeConnectionsSpy.mockClear();

      const res = await request(app)
        .patch(`/api/documents/${testDocId}/members/${viewerId}`)
        .set("Cookie", ownerCookie)
        .send({ role: "EDITOR" });

      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe("EDITOR");
      expect(closeConnectionsSpy).toHaveBeenCalledWith(testDocId);
    });

    it("prevents modifying the document owner's role (400)", async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDocId}/members/${ownerId}`)
        .set("Cookie", ownerCookie)
        .send({ role: "VIEWER" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("The document owner's role cannot be changed.");
    });

    it("rejects non-owner attempts to modify roles (403)", async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDocId}/members/${viewerId}`)
        .set("Cookie", editorCookie)
        .send({ role: "VIEWER" });

      expect(res.status).toBe(403);
    });

    it("returns 404 when updating non-existent member", async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDocId}/members/${nonMemberId}`)
        .set("Cookie", ownerCookie)
        .send({ role: "VIEWER" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/documents/:id/members/:userId", () => {
    it("prevents removing the document owner (400)", async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDocId}/members/${ownerId}`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("The document owner cannot be removed.");
    });

    it("rejects non-owner attempts to remove members (403)", async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDocId}/members/${viewerId}`)
        .set("Cookie", editorCookie);

      expect(res.status).toBe(403);
    });

    it("allows owner to remove a collaborator", async () => {
      closeConnectionsSpy.mockClear();

      const res = await request(app)
        .delete(`/api/documents/${testDocId}/members/${viewerId}`)
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(closeConnectionsSpy).toHaveBeenCalledWith(testDocId);

      // Verify member is gone
      const listRes = await request(app)
        .get(`/api/documents/${testDocId}/members`)
        .set("Cookie", ownerCookie);

      const memberIds = listRes.body.members.map((m: { id: string }) => m.id);
      expect(memberIds).not.toContain(viewerId);
    });

    it("returns 404 when deleting member who is not in the document", async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDocId}/members/${viewerId}`) // already deleted
        .set("Cookie", ownerCookie);

      expect(res.status).toBe(404);
    });
  });
});
