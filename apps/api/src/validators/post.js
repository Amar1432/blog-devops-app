import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain lowercase letters, numbers and hyphens");

const postFields = {
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(500).nullish(),
  content: z.string().min(1),
  published: z.boolean().optional(),
};

export const createPostSchema = z.object(postFields);

export const updatePostSchema = z
  .object(postFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
