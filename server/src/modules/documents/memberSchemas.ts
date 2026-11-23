import { z } from "zod";

export const addMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["EDITOR", "VIEWER"], {
    error: "Role must be EDITOR or VIEWER.",
  }),
});

export const updateMemberSchema = z.object({
  role: z.enum(["EDITOR", "VIEWER"], {
    error: "Role must be EDITOR or VIEWER.",
  }),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
