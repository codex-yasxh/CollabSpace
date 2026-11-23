import bcrypt from "bcryptjs";
import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import { pool, closePool } from "./db.js";
import { env } from "../config/env.js";

/**
 * Idempotent Seed Script for CollabSpace (T7.4)
 * - Refuses to run if NODE_ENV=production.
 * - ONLY writes to database specified in DATABASE_URL.
 * - Seed only creates what's missing. Never truncates or deletes existing rows.
 * - Creates demo users: alice@example.com, bob@example.com, charlie@example.com (password: demo-password-1)
 * - Creates a demo document owned by Alice with rich Yjs content (heading, paragraph, bullet list).
 * - Bob is Editor and Charlie is Viewer on that document.
 */
export async function seedDatabase(): Promise<{
  aliceId: string;
  bobId: string;
  charlieId: string;
  documentId: string;
}> {
  // 1. Production safety check
  if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") {
    console.error("❌ Refusing to run seed in production environment!");
    process.exit(1);
  }

  console.log("🌱 Running idempotent database seed on:", env.DATABASE_URL.replace(/:[^:@]+@/, ":***@"));

  const defaultPassword = "demo-password-1";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const demoUsers = [
    { email: "alice@example.com", name: "Alice", role: "OWNER" },
    { email: "bob@example.com", name: "Bob", role: "EDITOR" },
    { email: "charlie@example.com", name: "Charlie", role: "VIEWER" },
  ];

  const userIds: Record<string, string> = {};

  // 2. Ensure demo users exist (create only if missing)
  for (const u of demoUsers) {
    const existing = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [u.email],
    );

    if (existing.rows.length > 0) {
      userIds[u.email] = existing.rows[0]!.id;
      console.log(`✓ User ${u.email} already exists (${userIds[u.email]})`);
    } else {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [u.email, u.name, passwordHash],
      );
      userIds[u.email] = inserted.rows[0]!.id;
      console.log(`+ Created user ${u.email} (${userIds[u.email]})`);
    }
  }

  const aliceId = userIds["alice@example.com"]!;
  const bobId = userIds["bob@example.com"]!;
  const charlieId = userIds["charlie@example.com"]!;

  // 3. Ensure demo document exists
  const demoTitle = "CollabSpace Product Specification";
  const existingDoc = await pool.query<{ id: string }>(
    "SELECT id FROM documents WHERE owner_id = $1 AND title = $2",
    [aliceId, demoTitle],
  );

  let documentId: string;

  if (existingDoc.rows.length > 0) {
    documentId = existingDoc.rows[0]!.id;
    console.log(`✓ Demo document already exists (${documentId})`);
  } else {
    // Build valid Yjs binary state matching Tiptap's schema and fragment name ("default")
    const schema = getSchema([StarterKit]);
    const ydoc = new Y.Doc();
    const fragment = ydoc.getXmlFragment("default");

    const documentContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "CollabSpace Product Specification" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "CollabSpace is an open-source, real-time collaborative document platform featuring conflict-free CRDT synchronization, presence tracking, and granular permissions.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Core Architecture Features" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Real-time state convergence powered by Yjs and WebSocket providers." }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Multi-user presence with name flags and deterministic user presence colors." }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Role hierarchy: Owner, Editor, and Viewer with server-enforced mutation boundaries." }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Debounced persistence to PostgreSQL with custom save-status protocol synchronization." }],
                },
              ],
            },
          ],
        },
      ],
    };

    prosemirrorJSONToYXmlFragment(schema, documentContent, fragment);
    const contentState = Buffer.from(Y.encodeStateAsUpdate(ydoc));

    // Insert document
    const docRes = await pool.query<{ id: string }>(
      `INSERT INTO documents (title, owner_id, link_access, content_state)
       VALUES ($1, $2, 'NONE', $3)
       RETURNING id`,
      [demoTitle, aliceId, contentState],
    );
    documentId = docRes.rows[0]!.id;

    // Insert Owner in document_members
    await pool.query(
      `INSERT INTO document_members (document_id, user_id, role)
       VALUES ($1, $2, 'OWNER')
       ON CONFLICT (document_id, user_id) DO NOTHING`,
      [documentId, aliceId],
    );

    console.log(`+ Created demo document "${demoTitle}" (${documentId}) with ${contentState.byteLength} bytes Yjs state`);
  }

  // 4. Ensure Bob is Editor and Charlie is Viewer
  await pool.query(
    `INSERT INTO document_members (document_id, user_id, role)
     VALUES ($1, $2, 'EDITOR')
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = 'EDITOR'`,
    [documentId, bobId],
  );
  console.log(`✓ Added/verified Bob as EDITOR on ${documentId}`);

  await pool.query(
    `INSERT INTO document_members (document_id, user_id, role)
     VALUES ($1, $2, 'VIEWER')
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = 'VIEWER'`,
    [documentId, charlieId],
  );
  console.log(`✓ Added/verified Charlie as VIEWER on ${documentId}`);

  console.log("✅ Seed completed successfully!");
  return { aliceId, bobId, charlieId, documentId };
}

// Execute directly if run as main script
const isMain = process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js");
if (isMain) {
  seedDatabase()
    .then(() => closePool())
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
