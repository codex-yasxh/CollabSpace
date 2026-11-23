import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth, optionalAuth } from "../../middleware/requireAuth.js";
import { requireRole, assertRole, getDocIdParam } from "./documentMiddleware.js";
import { createDocumentSchema, updateDocumentSchema } from "./documentSchemas.js";
import {
  createDocument,
  listDocumentsForUser,
  getDocumentById,
  updateDocument,
  deleteDocument,
} from "./documentRepository.js";
import { AppError } from "../../middleware/errorHandler.js";

export const documentRouter = Router();

// 1. Create document (auth required, single transaction)
documentRouter.post(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createDocumentSchema.parse(req.body);
      const doc = await createDocument(req.user!.id, data.title);
      res.status(201).json({ document: doc });
    } catch (error) {
      next(error);
    }
  },
);

// 2. List documents for current user (auth required)
documentRouter.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docs = await listDocumentsForUser(req.user!.id);
      res.status(200).json({ documents: docs });
    } catch (error) {
      next(error);
    }
  },
);

// 3. Get document by ID (any role, including link access)
documentRouter.get(
  "/:id",
  optionalAuth,
  requireRole("VIEWER"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docId = getDocIdParam(req);
      const doc = await getDocumentById(docId);
      if (!doc) {
        throw new AppError(404, "NOT_FOUND", "Document not found.");
      }
      res.status(200).json({
        document: {
          ...doc,
          role: req.docRole,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// 4. Update document (rename: OWNER or EDITOR; link_access: OWNER)
documentRouter.patch(
  "/:id",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docId = getDocIdParam(req);
      const data = updateDocumentSchema.parse(req.body);

      // If modifying link_access, OWNER is strictly required; otherwise EDITOR suffices
      const requiredMinRole = data.link_access !== undefined ? "OWNER" : "EDITOR";
      const docRole = await assertRole(docId, req.user?.id, requiredMinRole);

      const updated = await updateDocument(docId, data);
      res.status(200).json({
        document: {
          ...updated,
          role: docRole,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// 5. Delete document (OWNER only)
documentRouter.delete(
  "/:id",
  optionalAuth,
  requireRole("OWNER"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docId = getDocIdParam(req);
      await deleteDocument(docId);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
