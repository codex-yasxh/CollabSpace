import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../../../database/db.js";
import { resolveRole, higherRole, hasMinRole } from "../resolveRole.js";

describe("Role Resolution & Section 9 Permission Matrix (Vitest + Postgres)", () => {
  let ownerId: string;
  let editorId: string;
  let viewerId: string;
  let nonMemberId: string;

  let docNoneId: string;
  let docViewerId: string;
  let docEditorId: string;

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

    // Helper to create a document with owner, editor, viewer members
    async function createDocWithMembers(linkAccess: "NONE" | "VIEWER" | "EDITOR"): Promise<string> {
      const docRes = await pool.query<{ id: string }>(
        `INSERT INTO documents (title, owner_id, link_access)
         VALUES ('Matrix Doc', $1, $2)
         RETURNING id`,
        [ownerId, linkAccess],
      );
      const docId = docRes.rows[0]!.id;

      await pool.query(
        `INSERT INTO document_members (document_id, user_id, role)
         VALUES 
           ($1, $2, 'OWNER'),
           ($1, $3, 'EDITOR'),
           ($1, $4, 'VIEWER')`,
        [docId, ownerId, editorId, viewerId],
      );

      return docId;
    }

    docNoneId = await createDocWithMembers("NONE");
    docViewerId = await createDocWithMembers("VIEWER");
    docEditorId = await createDocWithMembers("EDITOR");
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

  describe("resolveRole: Explicit 15-cell Permission Matrix (membership × link_access)", () => {
    const getDocId = (linkAccess: "NONE" | "VIEWER" | "EDITOR") => {
      if (linkAccess === "NONE") return docNoneId;
      if (linkAccess === "VIEWER") return docViewerId;
      return docEditorId;
    };

    const matrixCells = [
      // 1. Owner (3 cells)
      { cell: "Cell 1: Owner + link_access=NONE", getUser: () => ownerId, linkAccess: "NONE" as const, expected: "OWNER" },
      { cell: "Cell 2: Owner + link_access=VIEWER", getUser: () => ownerId, linkAccess: "VIEWER" as const, expected: "OWNER" },
      { cell: "Cell 3: Owner + link_access=EDITOR", getUser: () => ownerId, linkAccess: "EDITOR" as const, expected: "OWNER" },

      // 2. Editor (3 cells)
      { cell: "Cell 4: Editor + link_access=NONE", getUser: () => editorId, linkAccess: "NONE" as const, expected: "EDITOR" },
      { cell: "Cell 5: Editor + link_access=VIEWER", getUser: () => editorId, linkAccess: "VIEWER" as const, expected: "EDITOR" },
      { cell: "Cell 6: Editor + link_access=EDITOR", getUser: () => editorId, linkAccess: "EDITOR" as const, expected: "EDITOR" },

      // 3. Viewer (3 cells)
      { cell: "Cell 7: Viewer + link_access=NONE", getUser: () => viewerId, linkAccess: "NONE" as const, expected: "VIEWER" },
      { cell: "Cell 8: Viewer + link_access=VIEWER", getUser: () => viewerId, linkAccess: "VIEWER" as const, expected: "VIEWER" },
      { cell: "Cell 9: Viewer + link_access=EDITOR (promoted to EDITOR)", getUser: () => viewerId, linkAccess: "EDITOR" as const, expected: "EDITOR" },

      // 4. Non-member (3 cells)
      { cell: "Cell 10: Non-member + link_access=NONE (403 / no access)", getUser: () => nonMemberId, linkAccess: "NONE" as const, expected: null },
      { cell: "Cell 11: Non-member + link_access=VIEWER (inherits link VIEWER)", getUser: () => nonMemberId, linkAccess: "VIEWER" as const, expected: "VIEWER" },
      { cell: "Cell 12: Non-member + link_access=EDITOR (inherits link EDITOR)", getUser: () => nonMemberId, linkAccess: "EDITOR" as const, expected: "EDITOR" },

      // 5. Anonymous user / null userId (3 cells)
      { cell: "Cell 13: Anonymous + link_access=NONE (403 / no access)", getUser: () => null, linkAccess: "NONE" as const, expected: null },
      { cell: "Cell 14: Anonymous + link_access=VIEWER (inherits link VIEWER)", getUser: () => null, linkAccess: "VIEWER" as const, expected: "VIEWER" },
      { cell: "Cell 15: Anonymous + link_access=EDITOR (inherits link EDITOR)", getUser: () => null, linkAccess: "EDITOR" as const, expected: "EDITOR" },
    ];

    it.each(matrixCells)("$cell -> resolves to $expected", async ({ getUser, linkAccess, expected }) => {
      const docId = getDocId(linkAccess);
      const userId = getUser();
      const resolved = await resolveRole(userId, docId);
      expect(resolved).toBe(expected);
    });

    it("returns null for non-existent document (authenticated)", async () => {
      const missingDocId = "00000000-0000-0000-0000-000000000000";
      expect(await resolveRole(ownerId, missingDocId)).toBeNull();
    });

    it("returns null for non-existent document (anonymous)", async () => {
      const missingDocId = "00000000-0000-0000-0000-000000000000";
      expect(await resolveRole(null, missingDocId)).toBeNull();
    });
  });
});
