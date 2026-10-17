import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

// LeetCode usernames are alphanumeric plus hyphen/underscore, in
// practice well under 50 chars. This is a fast format check only —
// whether the username actually exists is a separate, network-based
// check in the ingestion service.
export const leetcodeUsernameSchema = z
  .string()
  .trim()
  .min(1, "Enter your LeetCode username")
  .max(50, "That username looks too long")
  .regex(/^[a-zA-Z0-9_-]+$/, "LeetCode usernames only contain letters, numbers, - and _");

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
