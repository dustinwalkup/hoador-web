/**
 * V2 Auth Validation Utilities
 *
 * Shared validation utilities for the auth system.
 * These utilities work with our Zod schemas and provide consistent validation across the app.
 */

import type { ZodError } from "zod";
import {
  joinCodeSchema,
  emailSignupSchema,
  googleSignupSchema,
  onboardingSchema,
  phoneSchema,
  addressSchema,
} from "../schemas/signup.schema";
import type {
  EmailSignupInput,
  GoogleSignupInput,
  OnboardingInput,
  ValidationError,
} from "../types/auth.types";

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Convert Zod errors to field-specific error messages
 */
export function formatZodErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  error.issues.forEach((issue) => {
    const field = issue.path.join(".");
    fieldErrors[field] = issue.message;
  });

  return fieldErrors;
}

/**
 * Convert Zod errors to structured validation errors
 */
export function formatValidationErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Check if an object has validation errors
 */
export function hasValidationErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Get first validation error message
 */
export function getFirstError(errors: Record<string, string>): string | null {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey] : null;
}

/**
 * Clear specific field errors
 */
export function clearFieldErrors(
  errors: Record<string, string>,
  fields: string[],
): Record<string, string> {
  const clearedErrors = { ...errors };
  fields.forEach((field) => {
    delete clearedErrors[field];
  });
  return clearedErrors;
}

// ============================================================================
// FIELD VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate join code
 */
export function validateJoinCode(joinCode: string): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  try {
    joinCodeSchema.parse({ joinCode });
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return { isValid: false, errors: formatZodErrors(error as ZodError) };
    }
    return { isValid: false, errors: { joinCode: "Invalid join code" } };
  }
}

/**
 * Validate email signup data
 */
export function validateEmailSignup(data: Partial<EmailSignupInput>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  try {
    emailSignupSchema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return { isValid: false, errors: formatZodErrors(error as ZodError) };
    }
    return { isValid: false, errors: { general: "Validation failed" } };
  }
}

/**
 * Validate Google signup data
 */
export function validateGoogleSignup(data: Partial<GoogleSignupInput>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  try {
    googleSignupSchema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return { isValid: false, errors: formatZodErrors(error as ZodError) };
    }
    return { isValid: false, errors: { general: "Validation failed" } };
  }
}

/**
 * Validate onboarding data
 */
export function validateOnboarding(data: Partial<OnboardingInput>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  try {
    onboardingSchema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return { isValid: false, errors: formatZodErrors(error as ZodError) };
    }
    return { isValid: false, errors: { general: "Validation failed" } };
  }
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): {
  isValid: boolean;
  error?: string;
  formatted?: string;
} {
  try {
    const formatted = phoneSchema.parse(phone);
    return { isValid: true, formatted };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as ZodError;
      const firstIssue = zodError.issues[0];
      return {
        isValid: false,
        error: firstIssue?.message || "Invalid phone number",
      };
    }
    return { isValid: false, error: "Invalid phone number" };
  }
}

/**
 * Validate address
 */
export function validateAddress(address: unknown): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  try {
    addressSchema.parse(address);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return { isValid: false, errors: formatZodErrors(error as ZodError) };
    }
    return { isValid: false, errors: { general: "Invalid address" } };
  }
}

// ============================================================================
// PARTIAL VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate individual fields as user types (for real-time validation)
 */
export function validateField(
  field: string,
  value: unknown,
  schema: "email" | "google" | "onboarding",
): string | null {
  try {
    // Create a partial object with just this field
    const data = { [field]: value };

    // Choose the appropriate schema
    const schemaToUse =
      schema === "email"
        ? emailSignupSchema.partial()
        : schema === "google"
          ? googleSignupSchema.partial()
          : onboardingSchema.partial();

    schemaToUse.parse(data);
    return null; // No error
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as ZodError;
      const issue = zodError.issues.find((i) => i.path.includes(field));
      return issue?.message || null;
    }
    return null;
  }
}

/**
 * Check if email signup form is complete
 */
export function isEmailSignupComplete(
  data: Partial<EmailSignupInput>,
): boolean {
  const required = [
    "email",
    "password",
    "firstName",
    "lastName",
    "phone",
    "address.street",
    "address.city",
    "address.state",
    "address.zipCode",
    "terms",
  ];

  return required.every((field) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      return (data as Record<string, unknown>)[parent]?.[
        child as keyof unknown
      ];
    }
    return (data as Record<string, unknown>)[field];
  });
}

/**
 * Check if Google signup form is complete
 */
export function isGoogleSignupComplete(
  data: Partial<GoogleSignupInput>,
): boolean {
  const required = [
    "phone",
    "address.street",
    "address.city",
    "address.state",
    "address.zipCode",
    "googleData.id",
    "googleData.email",
    "googleData.firstName",
    "googleData.lastName",
  ];

  return required.every((field) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      return (data as Record<string, unknown>)[parent]?.[
        child as keyof unknown
      ];
    }
    return (data as Record<string, unknown>)[field];
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Format as +1 (XXX) XXX-XXXX for 11 digits starting with 1
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if can't format
  return phone;
}

/**
 * Clean phone number for storage (digits only)
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Check if email is valid format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if password meets requirements
 */
export function checkPasswordStrength(password: string): {
  isValid: boolean;
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push("At least 8 characters");

  if (/[a-z]/.test(password)) score++;
  else feedback.push("At least one lowercase letter");

  if (/[A-Z]/.test(password)) score++;
  else feedback.push("At least one uppercase letter");

  if (/\d/.test(password)) score++;
  else feedback.push("At least one number");

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push("At least one special character (optional)");

  return {
    isValid: score >= 3, // Require at least uppercase, lowercase, and number
    score,
    feedback,
  };
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/**
 * Check if ZIP code is valid
 */
export function isValidZipCode(zipCode: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
}

/**
 * Format ZIP code
 */
export function formatZipCode(zipCode: string): string {
  const digits = zipCode.replace(/\D/g, "");

  if (digits.length === 5) {
    return digits;
  }

  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return zipCode;
}
