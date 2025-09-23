import { z, ZodError } from "zod";

// ---------------------------
// Schemas
// ---------------------------

// Join code validation (kept separate as it's used independently)
export const joinCodeSchema = z.object({
  joinCode: z
    .string()
    .min(1, "Join code is required")
    .min(3, "Join code must be at least 3 characters")
    .max(20, "Join code must be less than 20 characters")
    .regex(
      /^[A-Z0-9-_]+$/,
      "Join code can only contain uppercase letters, numbers, hyphens, and underscores",
    )
    .transform((val) => val.toUpperCase()),
});

// Email signup schema (email + password)
export const emailSignupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number"),
});

// Full signup schema (email + password + names)
export const signupSchema = emailSignupSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ---------------------------
// TypeScript Types
// ---------------------------

export type JoinCodeData = z.infer<typeof joinCodeSchema>;
export type EmailSignupData = z.infer<typeof emailSignupSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type LoginData = z.infer<typeof loginSchema>;

// ---------------------------
// Field Validators for per-field validation
// ---------------------------

type FieldPath = keyof EmailSignupData;

const fieldValidators: Record<FieldPath, z.ZodTypeAny> = {
  email: emailSignupSchema.shape.email,
  password: emailSignupSchema.shape.password,
};

// ---------------------------
// Validation Functions
// ---------------------------

export function validateField(field: FieldPath, value: unknown): string | null {
  try {
    const validator = fieldValidators[field];
    if (!validator) return null;

    validator.parse(value);
    return null;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return error.issues[0]?.message ?? "Invalid value";
    }
    return "Invalid value";
  }
}

/**
 * Validates an entire EmailSignupData object and returns a map of field errors.
 */
export function validateFields(data: EmailSignupData): Record<string, string> {
  const errors: Record<string, string> = {};

  try {
    emailSignupSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        errors[path] = issue.message;
      });
    }
  }

  return errors;
}
