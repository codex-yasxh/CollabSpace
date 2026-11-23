import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../app.js";
import { pool, closePool } from "../../../database/db.js";
import { signToken, AUTH_COOKIE_NAME } from "../../auth/authService.js";

const app = createApp();

describe("Document Endpoints & Permissions (Vitest + Supertest)", () => {
  let ownerUser: { id: string; email: string };
  let editorUser: { id: string; email: string };
  let viewerUser: { id: string; email: string };
  let noAccessUser: { id: string; email: string };

  let ownerCookie: string;
  let editorCookie: string;
  let viewerCookie: string;
  let noAccessCookie: string;

  let testDocId: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    // Create 4 users
    const uRes = await pool.query<{ id: string; email: string }>(
      `INSERT INTO users (name, email, password_hash)
       VALUES 
        ('Alice Owner', 'alice_doc@example.com', 'hash'),
        ('Bob Editor', 'bob_doc@example.com', 'hash'),
        ('Charlie Viewer', 'charlie_doc@example.com', 'hash'),
        ('Dave NoAccess', 'dave_doc@example.com', 'hash')
       RETURNING id, email`,
    );

    ownerUser = uRes.rows[0]!;
    editorUser = uRes.rows[1]!;
    viewerUser = uRes.rows[2]!;
    noAccessUser = uRes.rows[3]!;

    ownerCookie = `${AUTH_COOKIE_NAME}=${signToken({ userId: ownerUser.id, email: ownerUser.email })}`;
    editorCookie = `${AUTH_COOKIE_NAME}=${signToken({ userId: editorUser.id, email: editorUser.email })}`;
    viewerCookie = `${AUTH_COOKIE_NAME}=${signToken({ userId: viewerUser.id, email: viewerUser.email })}`;
    noAccessCookie = `${AUTH_COOKIE_NAME}=${signToken({ userId: noAccessUser.id, email: noAccessUser.email })}`;
  });

  afterAll(async () => {
    await closePool();
  });

  describe("POST /api/documents", () => {
    it("rejects unauthenticated requests with 401", async () => {
      await request(app)
        .post("/api/documents")
        .send({ title: "My Doc" })
        .expect(401);
    });

    it("creates doc plus OWNER member row in one transaction", async () => {
      const res = await request(app)
        .post("/api/documents")
        .set("Cookie", [ownerCookie])
        .send({ title: "Project report draft" })
        .expect(201);

      expect(res.body.document).toBeDefined();
      expect(res.body.document.id).toBeDefined();
      expect(res.body.document.title).toBe("Project report draft");
      expect(res.body.document.owner_id).toBe(ownerUser.id);
      expect(res.body.document.role).toBe("OWNER");

      testDocId = res.body.document.id;

      // Verify member row exists in database
      const memberRes = await pool.query(
        `SELECT role FROM document_members WHERE document_id = $1 AND user_id = $2`,
        [testDocId, ownerUser.id],
      );
      expect(memberRes.rows.length).toBe(1);
      expect(memberRes.rows[0].role).toBe("OWNER");
    });
  });

  describe("GET /api/documents (List)", () => {
    it("returns list of member documents sorted by updated_at desc", async () => {
      const res = await request(app)
        .get("/api/documents")
        .set("Cookie", [ownerCookie])
        .expect(200);

      expect(res.body.documents).toBeDefined();
      expect(res.body.documents.length).toBeGreaterThanOrEqual(1);
      expect(res.body.documents[0].title).toBe("Project report draft");
      expect(res.body.documents[0].role).toBe("OWNER");
    });

    it("returns empty list for user with no memberships", async () => {
      const res = await request(app)
        .get("/api/documents")
        .set("Cookie", [noAccessCookie])
        .expect(200);

      expect(res.body.documents).toEqual([]);
    });
  });

  describe("Permission Matrix: GET, PATCH, DELETE across Owner, Editor, Viewer, No Access", () => {
    beforeAll(async () => {
      // Add Bob as EDITOR member
      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role)
         VALUES ($1, $2, 'EDITOR')`,
        [testDocId, editorUser.id],
      );

      // Add Charlie as VIEWER member
      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role)
         VALUES ($1, $2, 'VIEWER')`,
        [testDocId, viewerUser.id],
      );
    });

    // 1. GET /api/documents/:id
    it("Owner can GET document", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [ownerCookie])
        .expect(200);
      expect(res.body.document.role).toBe("OWNER");
    });

    it("Editor can GET document", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [editorCookie])
        .expect(200);
      expect(res.body.document.role).toBe("EDITOR");
    });

    it("Viewer can GET document", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [viewerCookie])
        .expect(200);
      expect(res.body.document.role).toBe("VIEWER");
    });

    it("No-access user gets 403 on private document", async () => {
      await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [noAccessCookie])
        .expect(403);
    });

    it("Returns 404 for non-existent document", async () => {
      await request(app)
        .get("/api/documents/00000000-0000-0000-0000-000000000000")
        .set("Cookie", [ownerCookie])
        .expect(404);
    });

    // 2. PATCH Rename: Owner & Editor can rename; Viewer cannot
    it("Owner can rename document", async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [ownerCookie])
        .send({ title: "Renamed by Owner" })
        .expect(200);
      expect(res.body.document.title).toBe("Renamed by Owner");
    });

    it("Editor can rename document", async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [editorCookie])
        .send({ title: "Renamed by Editor" })
        .expect(200);
      expect(res.body.document.title).toBe("Renamed by Editor");
    });

    it("Viewer CANNOT rename document (403)", async () => {
      await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [viewerCookie])
        .send({ title: "Unauthorized Rename" })
        .expect(403);
    });

    // 3. PATCH Link Access: Owner only; Editor and Viewer cannot
    it("Editor CANNOT change link_access (403)", async () => {
      await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [editorCookie])
        .send({ link_access: "VIEWER" })
        .expect(403);
    });

    it("Owner CAN change link_access to VIEWER", async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [ownerCookie])
        .send({ link_access: "VIEWER" })
        .expect(200);
      expect(res.body.document.link_access).toBe("VIEWER");
    });

    it("No-access user now gets 200 with role VIEWER via link_access", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [noAccessCookie])
        .expect(200);
      expect(res.body.document.role).toBe("VIEWER");
    });

    it("Owner CAN change link_access to EDITOR and non-member receives EDITOR", async () => {
      const res = await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [ownerCookie])
        .send({ link_access: "EDITOR" })
        .expect(200);
      expect(res.body.document.link_access).toBe("EDITOR");

      // Non-member now gets role EDITOR
      const getRes = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [noAccessCookie])
        .expect(200);
      expect(getRes.body.document.role).toBe("EDITOR");

      // Non-member can rename when link_access is EDITOR
      await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [noAccessCookie])
        .send({ title: "Renamed by Link Editor" })
        .expect(200);
    });

    it("Viewer member is promoted to EDITOR when link_access is EDITOR", async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [viewerCookie])
        .expect(200);
      expect(res.body.document.role).toBe("EDITOR");
    });

    it("Owner can revert link_access to NONE and non-member gets 403 again", async () => {
      await request(app)
        .patch(`/api/documents/${testDocId}`)
        .set("Cookie", [ownerCookie])
        .send({ link_access: "NONE" })
        .expect(200);

      await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [noAccessCookie])
        .expect(403);
    });

    // 4. DELETE /api/documents/:id: Owner only
    it("Viewer and Editor CANNOT delete document (403)", async () => {
      await request(app)
        .delete(`/api/documents/${testDocId}`)
        .set("Cookie", [viewerCookie])
        .expect(403);

      await request(app)
        .delete(`/api/documents/${testDocId}`)
        .set("Cookie", [editorCookie])
        .expect(403);
    });

    it("Owner can delete document (200)", async () => {
      await request(app)
        .delete(`/api/documents/${testDocId}`)
        .set("Cookie", [ownerCookie])
        .expect(200);

      // Verify deleted
      await request(app)
        .get(`/api/documents/${testDocId}`)
        .set("Cookie", [ownerCookie])
        .expect(404);
    });
  });
});
