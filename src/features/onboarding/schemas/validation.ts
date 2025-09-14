import { z, ZodError } from "zod";

// ---------------------------
// Schemas
// ---------------------------

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

// Onboarding schema for profile completion
export const onboardingSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: phoneSchema,
  address: addressSchema,
  bio: z
    .string()
    .max(200, "Bio must be 200 characters or less")
    .optional()
    .or(z.literal("")),
  profileImageUrl: z
    .string()
    .url("Invalid image URL")
    .optional()
    .or(z.literal("")),
  agreeToTerms: z
    .boolean()
    .refine((val) => val === true, "You must agree to the terms"),
});

// ---------------------------
// TypeScript Types
// ---------------------------

export type AddressData = z.infer<typeof addressSchema>;
export type OnboardingData = z.infer<typeof onboardingSchema>;

// ---------------------------
// Field Validators for per-field validation
// ---------------------------

type FieldPath =
  | Exclude<keyof OnboardingData, "address">
  | `address.${keyof AddressData}`;

const fieldValidators: Record<FieldPath, z.ZodTypeAny> = {
  firstName: onboardingSchema.shape.firstName,
  lastName: onboardingSchema.shape.lastName,
  phone: onboardingSchema.shape.phone,
  bio: onboardingSchema.shape.bio,
  profileImageUrl: onboardingSchema.shape.profileImageUrl,
  agreeToTerms: onboardingSchema.shape.agreeToTerms,
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
 * Validates an entire OnboardingData object and returns a map of field errors.
 */
export function validateFields(data: OnboardingData): Record<string, string> {
  const errors: Record<string, string> = {};

  try {
    onboardingSchema.parse(data);
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
