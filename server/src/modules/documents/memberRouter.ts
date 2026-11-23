import { Router, type Request, type Response, type NextFunction } from "express";
import { optionalAuth } from "../../middleware/requireAuth.js";
import { requireRole, getDocIdParam } from "./documentMiddleware.js";
import { addMemberSchema, updateMemberSchema } from "./memberSchemas.js";
import {
  listDocumentMembers,
  getDocumentMember,
  addDocumentMember,
  updateDocumentMemberRole,
  removeDocumentMember,
} from "./memberRepository.js";
import { getDocumentById } from "./documentRepository.js";
import { findByEmail } from "../users/userRepository.js";
import { AppError } from "../../middleware/errorHandler.js";
import { rooms } from "../collaboration/rooms.js";

export const memberRouter = Router({ mergeParams: true });

// 1. List members (any role with access to the document)
memberRouter.get(
  "/",
  optionalAuth,
  requireRole("VIEWER"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docId = getDocIdParam(req);
      const members = await listDocumentMembers(docId);
      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  },
);

// 2. Add member / invite (OWNER only)
memberRouter.post(
  "/",
  optionalAuth,
  requireRole("OWNER"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docId = getDocIdParam(req);
      const data = addMemberSchema.parse(req.body);

      // Case-insensitive user lookup
      const user = await findByEmail(data.email);
      if (!user) {
        throw new AppError(
          404,
          "NOT_FOUND",
          "No account uses that email. Ask them to sign up first.",
        );
      }

      // Check if already a member
      const existing = await getDocumentMember(docId, user.id);
      if (existing) {
        throw new AppError(
          409,
          "CONFLICT",
          "User is already a collaborator on this document.",
        );
      }

      const member = await addDocumentMember(docId, user.id, data.role);
      rooms.closeAllConnections(docId);

      res.status(201).json({ member });
    } catch (error) {
      next(error);
    }
  },
);

// 3. Change member role (OWNER only; cannot touch owner)
memberRouter.patch(
  "/:userId",
  optionalAuth,
  requireRole("OWNER"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docId = getDocIdParam(req);
      const targetUserId = req.params.userId;
      if (!targetUserId || typeof targetUserId !== "string") {
        throw new AppError(400, "BAD_REQUEST", "User ID is required.");
      }

      const data = updateMemberSchema.parse(req.body);

      const doc = await getDocumentById(docId);
      if (!doc) {
        throw new AppError(404, "NOT_FOUND", "Document not found.");
      }

      // Check if target is the owner
      if (doc.owner_id === targetUserId) {
        throw new AppError(400, "BAD_REQUEST", "The document owner's role cannot be changed.");
      }

      const existing = await getDocumentMember(docId, targetUserId);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Member not found.");
      }

      if (existing.role === "OWNER") {
        throw new AppError(400, "BAD_REQUEST", "The document owner's role cannot be changed.");
      }

      const member = await updateDocumentMemberRole(docId, targetUserId, data.role);
      rooms.closeAllConnections(docId);

      res.status(200).json({ member });
    } catch (error) {
      next(error);
    }
  },
);

// 4. Remove member (OWNER only; cannot remove owner)
memberRouter.delete(
  "/:userId",
  optionalAuth,
  requireRole("OWNER"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docId = getDocIdParam(req);
      const targetUserId = req.params.userId;
      if (!targetUserId || typeof targetUserId !== "string") {
        throw new AppError(400, "BAD_REQUEST", "User ID is required.");
      }

      const doc = await getDocumentById(docId);
      if (!doc) {
        throw new AppError(404, "NOT_FOUND", "Document not found.");
      }

      // Check if target is the owner
      if (doc.owner_id === targetUserId) {
        throw new AppError(400, "BAD_REQUEST", "The document owner cannot be removed.");
      }

      const existing = await getDocumentMember(docId, targetUserId);
      if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Member not found.");
      }

      if (existing.role === "OWNER") {
        throw new AppError(400, "BAD_REQUEST", "The document owner cannot be removed.");
      }

      await removeDocumentMember(docId, targetUserId);
      rooms.closeAllConnections(docId);

      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
