import { z } from "zod";
import { timeZone, weightUnit } from "@/lib/validation/common";

export const email = z.string().trim().toLowerCase().min(3).max(254).email("Enter a valid email address");

/** Rule for new passwords (existing accounts may have shorter ones). */
export const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(128),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email,
  password: newPassword,
  timezone: timeZone.optional(),
  weightUnit: weightUnit.optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: newPassword,
});
