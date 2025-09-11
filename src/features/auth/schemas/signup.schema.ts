import { z } from "zod";

/**
 * V2 Auth Signup Schemas - Unified and Schema-First Design
 *
 * This file contains all validation schemas for the signup flow.
 * All server actions and client components use these schemas as the single source of truth.
 */

// ============================================================================
// BASE SCHEMAS
// ============================================================================

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
    .max(50, "Unit number must be 50 characters or less")
    .optional(), // Optional apartment/unit number
});

/**
 * Phone number validation schema with transformation
 */
export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .max(20, "Phone number must be 20 characters or less")
  .regex(/^[\d\s\(\)\-\+\.]+$/, "Please enter a valid phone number")
  .transform((val) => val.replace(/\D/g, "")) // Strip non-digits for validation
  .refine((val) => val.length >= 10, "Phone must have at least 10 digits")
  .refine((val) => val.length <= 11, "Phone must have 11 or fewer digits");

// ============================================================================
// SIGNUP METHOD SCHEMAS
// ============================================================================

/**
 * Email signup validation schema
 */
export const emailSignupSchema = z.object({
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
  phone: phoneSchema,
  address: addressSchema,
  terms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms of service and privacy policy",
  }),
});

/**
 * Google OAuth user data schema (from Better Auth)
 */
export const googleUserSchema = z.object({
  id: z.string().min(1, "Google user ID is required"),
  email: z.string().email("Invalid Google email"),
  firstName: z.string().min(1, "Google first name is required"),
  lastName: z.string().min(1, "Google last name is required"),
  profileImageUrl: z.string().url("Invalid profile image URL").optional(),
});

/**
 * Google signup schema (additional data collection after OAuth)
 */
export const googleSignupSchema = z.object({
  phone: phoneSchema,
  address: addressSchema,
  // Google OAuth data (validated separately)
  googleData: googleUserSchema,
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
  notifications: z
    .object({
      email: z.boolean().default(true),
      push: z.boolean().default(true),
    })
    .optional(),
});

// ============================================================================
// SERVER ACTION SCHEMAS (what gets sent to server)
// ============================================================================

/**
 * Complete email signup schema (includes join code for server processing)
 */
export const serverEmailSignupSchema = emailSignupSchema.extend({
  joinCode: z.string().min(1, "Join code is required"),
});

/**
 * Complete Google signup schema (includes join code for server processing)
 */
export const serverGoogleSignupSchema = googleSignupSchema.extend({
  joinCode: z.string().min(1, "Join code is required"),
});

/**
 * Email verification schema
 */
export const emailVerificationSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

/**
 * Resend verification email schema
 */
export const resendVerificationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Base types
export type JoinCodeInput = z.infer<typeof joinCodeSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type PhoneInput = z.infer<typeof phoneSchema>;

// Signup method types
export type EmailSignupInput = z.infer<typeof emailSignupSchema>;
export type GoogleUserInput = z.infer<typeof googleUserSchema>;
export type GoogleSignupInput = z.infer<typeof googleSignupSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// Server action types
export type ServerEmailSignupInput = z.infer<typeof serverEmailSignupSchema>;
export type ServerGoogleSignupInput = z.infer<typeof serverGoogleSignupSchema>;
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

/**
 * Generic server action response schema
 */
export const serverActionResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  message: z.string().optional(),
  data: z.any().optional(),
});

export type ServerActionResponse = z.infer<typeof serverActionResponseSchema>;

/**
 * Signup flow step validation
 */
export const signupStepSchema = z.enum([
  "join-code",
  "method-selection",
  "email-details",
  "google-oauth",
  "google-details",
  "email-verification",
  "onboarding",
]);

export type SignupStep = z.infer<typeof signupStepSchema>;

/**
 * Signup method validation
 */
export const signupMethodSchema = z.enum(["email", "google"]);

export type SignupMethod = z.infer<typeof signupMethodSchema>;

/**
 * User status validation (matches database enum)
 */
export const userStatusSchema = z.enum([
  "pending_verification",
  "incomplete_profile",
  "active",
  "suspended",
  "inactive",
]);

export type UserStatus = z.infer<typeof userStatusSchema>;
