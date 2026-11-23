import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../middleware/errorHandler.js";
import { resolveRole, hasMinRole, type DocumentRole } from "../access/resolveRole.js";
import { getDocumentById } from "./documentRepository.js";

export function getDocIdParam(req: Request): string {
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    throw new AppError(400, "BAD_REQUEST", "Document ID is required.");
  }
  return id;
}

export async function assertRole(
  documentId: string,
  userId: string | null | undefined,
  minRole: DocumentRole,
): Promise<DocumentRole> {
  // Check existence first
  const doc = await getDocumentById(documentId);
  if (!doc) {
    throw new AppError(404, "NOT_FOUND", "Document not found.");
  }

  const effectiveRole = await resolveRole(userId, documentId);

  if (!effectiveRole) {
    throw new AppError(403, "FORBIDDEN", "You don't have access to this document.");
  }

  if (!hasMinRole(effectiveRole, minRole)) {
    throw new AppError(403, "FORBIDDEN", "You don't have permission to perform this action.");
  }

  return effectiveRole;
}

export function requireRole(minRole: DocumentRole) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const documentId = getDocIdParam(req);
      req.docRole = await assertRole(documentId, req.user?.id, minRole);
      next();
    } catch (error) {
      next(error);
    }
  };
}
