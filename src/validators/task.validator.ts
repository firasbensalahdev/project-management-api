import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(1000).optional(),
  assignedToId: z.number().int().positive().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  assignedToId: z.number().int().positive().nullable().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

export const assignTaskSchema = z.object({
  assignedToId: z.number().int().positive().nullable(),
});

export const taskQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assignedToId: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
