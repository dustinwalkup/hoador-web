import { z } from "zod";

/**
 * Field-level building blocks for profile editing.
 *
 * Shared between the client-side edit form (where most fields are required)
 * and the API PATCH handler (where every top-level field is optional because
 * the endpoint accepts partial updates). Keeping the field-level rules in one
 * place prevents drift between the two callers.
 */

const firstName = z.string().min(1, "First name is required");
const lastName = z.string().min(1, "Last name is required");
const email = z.string().email("Please enter a valid email");
const phone = z.string().refine((val) => !val || /^\d{10}$/.test(val), {
  message: "Please enter a valid 10-digit phone number",
});
const bio = z.string().max(500, "Bio must be 500 characters or less");
const profileImageUrl = z.string().url();

export const addressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z
    .string()
    .min(4, "Zip code must be at least 4 characters")
    .max(10, "Zip code must be 10 characters or less"),
});

/** Client-side edit form schema — fields required for the "edit profile" modal. */
export const editProfileFormSchema = z.object({
  firstName,
  lastName,
  phone: phone.optional(),
  bio: bio.optional(),
  address: addressSchema,
});

export type EditProfileFormData = z.infer<typeof editProfileFormSchema>;

/** API PATCH schema — every field optional (partial updates allowed). */
export const updateProfileApiSchema = z.object({
  firstName: firstName.optional(),
  lastName: lastName.optional(),
  email: email.optional(),
  phone: phone.optional(),
  bio: bio.optional(),
  profileImageUrl: profileImageUrl.optional(),
  address: addressSchema.optional(),
});
