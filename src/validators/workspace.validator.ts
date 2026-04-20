import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(["admin", "member"]).default("member"),
});

export const removeMemberSchema = z.object({
  userId: z.number().int().positive(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
