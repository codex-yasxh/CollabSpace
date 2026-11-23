import { query, withTransaction } from "../../database/db.js";
import type { DocumentRole, LinkAccess } from "../access/resolveRole.js";

export interface Document {
  id: string;
  title: string;
  owner_id: string;
  owner_name?: string;
  link_access: LinkAccess;
  content_state?: Buffer | null;
  created_at: Date;
  updated_at: Date;
  role?: DocumentRole;
}

export interface DocumentListItem {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  role: DocumentRole;
  link_access: LinkAccess;
  created_at: Date;
  updated_at: Date;
}

export async function createDocument(
  ownerId: string,
  title: string = "Untitled document",
): Promise<Document> {
  const trimmedTitle = title.trim() || "Untitled document";

  return withTransaction(async (client) => {
    // 1. Insert document
    const docResult = await client.query<Document>(
      `INSERT INTO documents (title, owner_id, link_access)
       VALUES ($1, $2, 'NONE')
       RETURNING id, title, owner_id, link_access, created_at, updated_at`,
      [trimmedTitle, ownerId],
    );
    const document = docResult.rows[0]!;

    // 2. Insert OWNER member row
    await client.query(
      `INSERT INTO document_members (document_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [document.id, ownerId],
    );

    return { ...document, role: "OWNER" };
  });
}

export async function listDocumentsForUser(userId: string): Promise<DocumentListItem[]> {
  const result = await query<DocumentListItem>(
    `SELECT 
      d.id,
      d.title,
      d.owner_id,
      u.name AS owner_name,
      dm.role,
      d.link_access,
      d.created_at,
      d.updated_at
     FROM documents d
     JOIN document_members dm ON d.id = dm.document_id AND dm.user_id = $1
     JOIN users u ON d.owner_id = u.id
     ORDER BY d.updated_at DESC`,
    [userId],
  );

  return result.rows;
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const result = await query<Document>(
    `SELECT 
      d.id,
      d.title,
      d.owner_id,
      u.name AS owner_name,
      d.link_access,
      d.created_at,
      d.updated_at
     FROM documents d
     JOIN users u ON d.owner_id = u.id
     WHERE d.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function updateDocument(
  id: string,
  updates: { title?: string | undefined; link_access?: LinkAccess | undefined },
): Promise<Document | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [id];
  let paramIndex = 2;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    params.push(updates.title.trim() || "Untitled document");
    setClauses.push(`updated_at = now()`);
  }

  if (updates.link_access !== undefined) {
    setClauses.push(`link_access = $${paramIndex++}`);
    params.push(updates.link_access);
  }

  if (setClauses.length === 0) {
    return getDocumentById(id);
  }

  const result = await query<Document>(
    `UPDATE documents
     SET ${setClauses.join(", ")}
     WHERE id = $1
     RETURNING id, title, owner_id, link_access, created_at, updated_at`,
    params,
  );

  return result.rows[0] ?? null;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM documents WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
