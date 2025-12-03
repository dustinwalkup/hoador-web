import { z } from "zod";

export const reviewSchema = z
  .object({
    rentalId: z.string().uuid("Invalid rental ID").optional(),
    requestId: z.string().uuid("Invalid request ID").optional(),
    rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
    comment: z
      .string()
      .min(10, "Comment must be at least 10 characters")
      .max(2000, "Comment must be less than 2000 characters"),
    accuracyRating: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .nullable(),
    listingConditionRating: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .nullable(),
    ownerCommunicationRating: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .nullable(),
  })
  .refine((data) => data.rentalId || data.requestId, {
    message: "Either rentalId or requestId is required",
  });

export type ReviewFormData = z.infer<typeof reviewSchema>;

