import { z, ZodError } from "zod";

// ---------------------------
// Schemas
// ---------------------------

// Join code validation (kept separate as it's used independently)
export const joinCodeSchema = z.object({
  joinCode: z.string().min(1, "Join code is required"),
});

// Base signup schema for simplified form (email, password, joinCode)
export const emailSignupBaseSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number"),
  joinCode: z.string().min(1, "Join code is required"),
});

// Client-side schema (join code handled separately)
export const emailSignupSchema = emailSignupBaseSchema.omit({ joinCode: true });

// Server-side schema (same as base for simplified form)
export const emailSignupServerSchema = emailSignupBaseSchema;

// ---------------------------
// TypeScript Types
// ---------------------------

export type JoinCodeData = z.infer<typeof joinCodeSchema>;
export type EmailSignupData = z.infer<typeof emailSignupSchema>;
export type EmailSignupServerData = z.infer<typeof emailSignupServerSchema>;

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
