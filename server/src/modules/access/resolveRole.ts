import { query } from "../../database/db.js";
import type pg from "pg";

export type DocumentRole = "OWNER" | "EDITOR" | "VIEWER";
export type LinkAccess = "NONE" | "VIEWER" | "EDITOR";

const ROLE_RANK: Record<DocumentRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function higherRole(
  r1: DocumentRole | null,
  r2: DocumentRole | null,
): DocumentRole | null {
  if (!r1) return r2;
  if (!r2) return r1;
  return ROLE_RANK[r1] >= ROLE_RANK[r2] ? r1 : r2;
}

export function hasMinRole(
  userRole: DocumentRole | null,
  minRequired: DocumentRole,
): boolean {
  if (!userRole) return false;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRequired];
}

export async function resolveRole(
  userId: string | null | undefined,
  documentId: string,
  dbClient?: pg.PoolClient | typeof query,
): Promise<DocumentRole | null> {
  const queryFn = dbClient
    ? typeof dbClient === "function"
      ? dbClient
      : dbClient.query.bind(dbClient)
    : query;

  // 1. Fetch document metadata
  const docResult = await queryFn<{ link_access: LinkAccess }>(
    `SELECT link_access FROM documents WHERE id = $1`,
    [documentId],
  );

  if (docResult.rows.length === 0) {
    return null;
  }

  const doc = docResult.rows[0]!;
  const linkRole: DocumentRole | null =
    doc.link_access === "NONE" ? null : (doc.link_access as DocumentRole);

  // 2. Fetch member row if userId provided
  let memberRole: DocumentRole | null = null;
  if (userId) {
    const memberResult = await queryFn<{ role: DocumentRole }>(
      `SELECT role FROM document_members WHERE document_id = $1 AND user_id = $2`,
      [documentId, userId],
    );
    if (memberResult.rows.length > 0) {
      memberRole = memberResult.rows[0]!.role;
    }
  }

  // Effective role is the higher of member role and link access role
  return higherRole(memberRole, linkRole);
}
