import { z } from "zod";

// ---------------------------
// Base Field Schemas
// ---------------------------

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(255, "Email must be 255 characters or less")
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or less")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  );

export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(50, "Name must be 50 characters or less")
  .trim();

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .max(20, "Phone number must be 20 characters or less")
  .regex(/^[\d\s\(\)\-\+\.]+$/, "Please enter a valid phone number")
  .transform((val) => val.replace(/\D/g, "")) // Remove non-digits for validation
  .refine(
    (val) => val.length >= 10,
    "Phone number must have at least 10 digits",
  )
  .refine(
    (val) => val.length <= 11,
    "Phone number must have at most 11 digits",
  );

// ---------------------------
// Address Schema
// ---------------------------

export const addressSchema = z.object({
  street: z
    .string()
    .min(1, "Street address is required")
    .max(255, "Street address must be 255 characters or less")
    .trim(),
  city: z
    .string()
    .min(1, "City is required")
    .max(100, "City must be 100 characters or less")
    .trim(),
  state: z
    .string()
    .min(1, "State is required")
    .max(50, "State must be 50 characters or less")
    .trim()
    .toUpperCase(),
  zipCode: z
    .string()
    .min(1, "ZIP code is required")
    .regex(
      /^\d{5}(-\d{4})?$/,
      "ZIP code must be 5 or 9 digits (12345 or 12345-6789)",
    )
    .trim(),
  unit: z
    .string()
    .max(20, "Unit number must be 20 characters or less")
    .trim()
    .optional(),
});

// ---------------------------
// Authentication Schemas
// ---------------------------

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"), // Less strict for login
});

/**
 * Join code validation schema
 */
export const joinCodeSchema = z.object({
  joinCode: z
    .string()
    .min(1, "Join code is required")
    .max(20, "Join code must be 20 characters or less")
    .trim(),
});

/**
 * Email signup validation schema (current simplified form)
 */
export const emailSignupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

/**
 * Email signup with password confirmation (for forms that need it)
 */
export const emailSignupWithConfirmSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    firstName: nameSchema,
    lastName: nameSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Complete email signup with address (for future multi-step signup)
 */
export const completeEmailSignupSchema = emailSignupSchema.extend({
  phone: phoneSchema,
  address: addressSchema,
});

/**
 * Google OAuth signup schema (additional data collection)
 */
export const googleSignupSchema = z.object({
  // Google provides: email, firstName, lastName, profileImageUrl
  // We collect: phone, address
  phone: phoneSchema,
  address: addressSchema,
});

/**
 * Profile details schema (for both email and Google signup)
 */
export const profileDetailsSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  address: addressSchema,
});

/**
 * Onboarding completion schema (post-verification)
 */
export const onboardingSchema = z.object({
  bio: z
    .string()
    .max(500, "Bio must be 500 characters or less")
    .trim()
    .optional(),
  profileImageUrl: z
    .string()
    .url("Please enter a valid image URL")
    .max(500, "Image URL must be 500 characters or less")
    .optional(),
});

// ---------------------------
// TypeScript Types
// ---------------------------

export type LoginData = z.infer<typeof loginSchema>;
export type JoinCodeData = z.infer<typeof joinCodeSchema>;
export type EmailSignupData = z.infer<typeof emailSignupSchema>;
export type EmailSignupWithConfirmData = z.infer<
  typeof emailSignupWithConfirmSchema
>;
export type CompleteEmailSignupData = z.infer<typeof completeEmailSignupSchema>;
export type GoogleSignupData = z.infer<typeof googleSignupSchema>;
export type ProfileDetailsData = z.infer<typeof profileDetailsSchema>;
export type OnboardingData = z.infer<typeof onboardingSchema>;
export type AddressData = z.infer<typeof addressSchema>;

// Legacy type aliases for backward compatibility
export type EmailSignupInput = EmailSignupData;
export type LoginInput = LoginData;
export type JoinCodeInput = JoinCodeData;

// ---------------------------
// Field Validators for per-field validation
// ---------------------------

type EmailSignupFieldPath = keyof EmailSignupData;

const fieldValidators: Record<EmailSignupFieldPath, z.ZodTypeAny> = {
  email: emailSignupSchema.shape.email,
  password: emailSignupSchema.shape.password,
  firstName: emailSignupSchema.shape.firstName,
  lastName: emailSignupSchema.shape.lastName,
};

// ---------------------------
// Validation Helper Functions
// ---------------------------

/**
 * Validates a single field and returns error message if invalid
 */
export function validateField(
  field: EmailSignupFieldPath,
  value: unknown,
): string | null {
  try {
    const validator = fieldValidators[field];
    if (!validator) return null;

    validator.parse(value);
    return null;
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return error.issues[0]?.message ?? "Invalid value";
    }
    return "Invalid value";
  }
}

/**
 * Validates an entire EmailSignupData object and returns a map of field errors
 */
export function validateEmailSignupFields(
  data: EmailSignupData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  try {
    emailSignupSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        errors[path] = issue.message;
      });
    }
  }

  return errors;
}
