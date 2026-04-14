import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
});

export const presignedUrlSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"], {
    error: () => ({ message: "Only JPEG, PNG and WebP are allowed" }),
  }),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
