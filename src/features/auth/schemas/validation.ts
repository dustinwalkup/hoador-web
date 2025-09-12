import { z, ZodError } from "zod";

// ---------------------------
// Schemas
// ---------------------------

// Join code validation (kept separate as it's used independently)
export const joinCodeSchema = z.object({
  joinCode: z.string().min(1, "Join code is required"),
});

// Address validation schema
export const addressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z
    .string()
    .length(2, "State must be 2 characters")
    .regex(/^[A-Z]{2}$/, "State must be a valid 2-letter code (e.g., CA)")
    .transform((val) => val.toUpperCase()),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "ZIP code must be 5 digits or 5+4 format"),
});

// Phone validation with transformation
export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(/^[\d\s\-()+.]+$/, "Invalid phone number format")
  .transform((val) => val.replace(/\D/g, ""))
  .refine((val) => val.length >= 10, "Phone number must be at least 10 digits");

// Base signup schema (includes join code for server-side validation)
export const emailSignupBaseSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number"),
  phone: phoneSchema,
  address: addressSchema,
  agreeToTerms: z
    .boolean()
    .refine((val) => val === true, "You must agree to the terms"),
  joinCode: z.string().min(1, "Join code is required"),
});

// Client-side schema (join code handled separately)
export const emailSignupSchema = emailSignupBaseSchema.omit({ joinCode: true });

// Server-side schema (full schema including join code)
export const emailSignupServerSchema = emailSignupBaseSchema;

// ---------------------------
// TypeScript Types
// ---------------------------

export type JoinCodeData = z.infer<typeof joinCodeSchema>;
export type AddressData = z.infer<typeof addressSchema>;
export type EmailSignupData = z.infer<typeof emailSignupSchema>;
export type EmailSignupServerData = z.infer<typeof emailSignupServerSchema>;

// ---------------------------
// Field Validators for per-field validation
// ---------------------------

type FieldPath =
  | Exclude<keyof EmailSignupData, "address">
  | `address.${keyof AddressData}`;

const fieldValidators: Record<FieldPath, z.ZodTypeAny> = {
  firstName: emailSignupSchema.shape.firstName,
  lastName: emailSignupSchema.shape.lastName,
  email: emailSignupSchema.shape.email,
  password: emailSignupSchema.shape.password,
  phone: emailSignupSchema.shape.phone,
  agreeToTerms: emailSignupSchema.shape.agreeToTerms,
  "address.street": addressSchema.shape.street,
  "address.city": addressSchema.shape.city,
  "address.state": addressSchema.shape.state,
  "address.zipCode": addressSchema.shape.zipCode,
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
