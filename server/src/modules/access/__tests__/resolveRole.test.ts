import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../../../database/db.js";
import { resolveRole, higherRole, hasMinRole } from "../resolveRole.js";

describe("Role Resolution & Section 9 Permission Matrix (Vitest + Postgres)", () => {
  let ownerId: string;
  let editorId: string;
  let viewerId: string;
  let nonMemberId: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM document_members");
    await pool.query("DELETE FROM documents");
    await pool.query("DELETE FROM users");

    // Create 4 users
    const uRes = await pool.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash)
       VALUES 
        ('Owner', 'owner@example.com', 'hash'),
        ('Editor', 'editor@example.com', 'hash'),
        ('Viewer', 'viewer@example.com', 'hash'),
        ('NonMember', 'nonmember@example.com', 'hash')
       RETURNING id`,
    );

    ownerId = uRes.rows[0]!.id;
    editorId = uRes.rows[1]!.id;
    viewerId = uRes.rows[2]!.id;
    nonMemberId = uRes.rows[3]!.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe("Unit: higherRole and hasMinRole helpers", () => {
    it("correctly compares roles according to VIEWER < EDITOR < OWNER hierarchy", () => {
      expect(higherRole("OWNER", "EDITOR")).toBe("OWNER");
      expect(higherRole("EDITOR", "VIEWER")).toBe("EDITOR");
      expect(higherRole("VIEWER", "EDITOR")).toBe("EDITOR");
      expect(higherRole(null, "VIEWER")).toBe("VIEWER");
      expect(higherRole("EDITOR", null)).toBe("EDITOR");
      expect(higherRole(null, null)).toBeNull();

      expect(hasMinRole("OWNER", "OWNER")).toBe(true);
      expect(hasMinRole("OWNER", "EDITOR")).toBe(true);
      expect(hasMinRole("OWNER", "VIEWER")).toBe(true);

      expect(hasMinRole("EDITOR", "OWNER")).toBe(false);
      expect(hasMinRole("EDITOR", "EDITOR")).toBe(true);
      expect(hasMinRole("EDITOR", "VIEWER")).toBe(true);

      expect(hasMinRole("VIEWER", "OWNER")).toBe(false);
      expect(hasMinRole("VIEWER", "EDITOR")).toBe(false);
      expect(hasMinRole("VIEWER", "VIEWER")).toBe(true);
      expect(hasMinRole(null, "VIEWER")).toBe(false);
    });
  });

  describe("resolveRole: Full Permission Matrix across member role × link_access", () => {
    async function createTestDoc(linkAccess: "NONE" | "VIEWER" | "EDITOR"): Promise<string> {
      const docRes = await pool.query<{ id: string }>(
        `INSERT INTO documents (title, owner_id, link_access)
         VALUES ('Matrix Doc', $1, $2)
         RETURNING id`,
        [ownerId, linkAccess],
      );
      const docId = docRes.rows[0]!.id;

      // Add owner member row
      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role)
         VALUES ($1, $2, 'OWNER')`,
        [docId, ownerId],
      );

      // Add editor member row
      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role)
         VALUES ($1, $2, 'EDITOR')`,
        [docId, editorId],
      );

      // Add viewer member row
      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role)
         VALUES ($1, $2, 'VIEWER')`,
        [docId, viewerId],
      );

      return docId;
    }

    it("evaluates when link_access is NONE", async () => {
      const docId = await createTestDoc("NONE");

      expect(await resolveRole(ownerId, docId)).toBe("OWNER");
      expect(await resolveRole(editorId, docId)).toBe("EDITOR");
      expect(await resolveRole(viewerId, docId)).toBe("VIEWER");
      expect(await resolveRole(nonMemberId, docId)).toBeNull();
      expect(await resolveRole(null, docId)).toBeNull();
    });

    it("evaluates when link_access is VIEWER", async () => {
      const docId = await createTestDoc("VIEWER");

      expect(await resolveRole(ownerId, docId)).toBe("OWNER");
      expect(await resolveRole(editorId, docId)).toBe("EDITOR");
      expect(await resolveRole(viewerId, docId)).toBe("VIEWER");
      // Non-member receives link role (VIEWER)
      expect(await resolveRole(nonMemberId, docId)).toBe("VIEWER");
      // Anonymous receives link role (VIEWER)
      expect(await resolveRole(null, docId)).toBe("VIEWER");
    });

    it("evaluates when link_access is EDITOR", async () => {
      const docId = await createTestDoc("EDITOR");

      expect(await resolveRole(ownerId, docId)).toBe("OWNER");
      expect(await resolveRole(editorId, docId)).toBe("EDITOR");
      // Viewer member gets promoted to EDITOR via higher link_access
      expect(await resolveRole(viewerId, docId)).toBe("EDITOR");
      // Non-member receives link role (EDITOR)
      expect(await resolveRole(nonMemberId, docId)).toBe("EDITOR");
      // Anonymous receives link role (EDITOR)
      expect(await resolveRole(null, docId)).toBe("EDITOR");
    });

    it("returns null for non-existent document", async () => {
      const missingDocId = "00000000-0000-0000-0000-000000000000";
      expect(await resolveRole(ownerId, missingDocId)).toBeNull();
      expect(await resolveRole(null, missingDocId)).toBeNull();
    });
  });
});
