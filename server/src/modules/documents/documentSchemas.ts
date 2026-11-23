import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().trim().max(255, "Title must be at most 255 characters").optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(255, "Title must be at most 255 characters").optional(),
  link_access: z.enum(["NONE", "VIEWER", "EDITOR"]).optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
