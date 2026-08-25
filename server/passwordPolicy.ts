import { z } from "zod";

export const PASSWORD_POLICY_MESSAGE = "Password must contain at least one letter and one number or symbol.";

/** Shared server-side policy for registration, password reset, and password changes. */
export const strongPasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-zA-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/, PASSWORD_POLICY_MESSAGE);
