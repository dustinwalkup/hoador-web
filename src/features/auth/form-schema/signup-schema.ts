import { z } from "zod";

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
 * Email signup validation schema
 */
export const emailSignupSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .max(255, "Email must be 255 characters or less")
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or less")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name must be 50 characters or less")
      .trim(),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(50, "Last name must be 50 characters or less")
      .trim(),
    phone: z
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
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Address validation schema
 */
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

/**
 * Profile details schema (for both email and Google signup)
 */
export const profileDetailsSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be 50 characters or less")
    .trim(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must be 50 characters or less")
    .trim(),
  phone: z
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
    ),
  address: addressSchema,
});

/**
 * Google OAuth signup schema (additional data collection)
 */
export const googleSignupSchema = z.object({
  // Google provides: email, firstName, lastName, profileImageUrl
  // We collect: phone, address
  phone: z
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
    ),
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

/**
 * Complete signup flow schemas
 */
export const completeEmailSignupSchema = emailSignupSchema.merge(addressSchema);
export const completeGoogleSignupSchema = googleSignupSchema;

// Type exports for TypeScript
export type JoinCodeInput = z.infer<typeof joinCodeSchema>;
export type EmailSignupInput = z.infer<typeof emailSignupSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type ProfileDetailsInput = z.infer<typeof profileDetailsSchema>;
export type GoogleSignupInput = z.infer<typeof googleSignupSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type CompleteEmailSignupInput = z.infer<
  typeof completeEmailSignupSchema
>;
export type CompleteGoogleSignupInput = z.infer<
  typeof completeGoogleSignupSchema
>;
