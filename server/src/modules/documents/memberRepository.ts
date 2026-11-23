import { pool } from "../../database/db.js";
import type { DocumentRole } from "../access/resolveRole.js";

export interface MemberWithUser {
  id: string; // user id
  name: string;
  email: string;
  role: DocumentRole;
  createdAt: string;
}

export async function listDocumentMembers(documentId: string): Promise<MemberWithUser[]> {
  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      dm.role,
      dm.created_at as "createdAt"
    FROM document_members dm
    JOIN users u ON dm.user_id = u.id
    WHERE dm.document_id = $1
    ORDER BY 
      CASE dm.role
        WHEN 'OWNER' THEN 1
        WHEN 'EDITOR' THEN 2
        WHEN 'VIEWER' THEN 3
        ELSE 4
      END,
      dm.created_at ASC
  `;
  const result = await pool.query<MemberWithUser>(query, [documentId]);
  return result.rows;
}

export async function getDocumentMember(
  documentId: string,
  userId: string,
): Promise<MemberWithUser | null> {
  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      dm.role,
      dm.created_at as "createdAt"
    FROM document_members dm
    JOIN users u ON dm.user_id = u.id
    WHERE dm.document_id = $1 AND dm.user_id = $2
  `;
  const result = await pool.query<MemberWithUser>(query, [documentId, userId]);
  return result.rows[0] ?? null;
}

export async function addDocumentMember(
  documentId: string,
  userId: string,
  role: "EDITOR" | "VIEWER",
): Promise<MemberWithUser> {
  await pool.query(
    `INSERT INTO document_members (document_id, user_id, role)
     VALUES ($1, $2, $3)`,
    [documentId, userId, role],
  );

  const member = await getDocumentMember(documentId, userId);
  if (!member) {
    throw new Error("Failed to retrieve added member.");
  }
  return member;
}

export async function updateDocumentMemberRole(
  documentId: string,
  userId: string,
  role: "EDITOR" | "VIEWER",
): Promise<MemberWithUser> {
  await pool.query(
    `UPDATE document_members
     SET role = $3
     WHERE document_id = $1 AND user_id = $2`,
    [documentId, userId, role],
  );

  const member = await getDocumentMember(documentId, userId);
  if (!member) {
    throw new Error("Failed to retrieve updated member.");
  }
  return member;
}

export async function removeDocumentMember(
  documentId: string,
  userId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM document_members
     WHERE document_id = $1 AND user_id = $2`,
    [documentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
