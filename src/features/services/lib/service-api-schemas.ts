import { z } from "zod";

import { rejectionReasonSchema } from "@/features/admin/schemas/listing-review.schema";

/** POST /api/services/listings */
export const createServiceListingSchema = z.object({
  communityId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(20000),
  pricingType: z.enum(["fixed", "hourly"]),
  price: z.number().nonnegative(),
  ownerPoliciesAcknowledged: z.boolean().refine((value) => value === true, {
    message: "You must acknowledge owner policies",
  }),
  serviceNotes: z.string().max(5000).optional().nullable(),
});

/** PATCH /api/services/listings/[id] */
export const patchServiceListingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(20000).optional(),
  pricingType: z.enum(["fixed", "hourly"]).optional(),
  price: z.number().nonnegative().optional(),
  ownerPoliciesAcknowledged: z.boolean().optional(),
  serviceNotes: z.string().max(5000).optional().nullable(),
});

/** POST /api/services/bookings */
export const createServiceBookingSchema = z.object({
  listingId: z.string().uuid(),
  proposedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Invalid date (use YYYY-MM-DD)"),
  proposedTime: z.string().min(1).max(32),
  hours: z.number().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  paymentMethodId: z.string().optional(),
  serviceAgreementAccepted: z.boolean().refine((val) => val === true, {
    message:
      "You must accept the Service Agreement and all policies to continue",
  }),
  cancellationRefundAcknowledged: z.boolean().optional(),
  safetyLiabilityAccepted: z.boolean().optional(),
  paymentPayoutAccepted: z.boolean().optional(),
  platformTermsAccepted: z.boolean().optional(),
});

/** POST /api/services/bookings/[id]/decline */
export const declineServiceBookingSchema = z.object({
  reason: z.string().min(1).max(2000),
});

/** POST /api/services/bookings/[id]/cancel */
export const cancelServiceBookingSchema = z.object({
  reason: z.string().max(1000).optional(),
});

/** POST /api/services/bookings/[id]/reviews */
export const submitServiceReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional(),
});

/** POST /api/admin/services/listings/[id]/approve */
export const approveServiceListingSchema = z.object({
  note: z.string().max(2000).optional(),
});

/** POST /api/admin/services/listings/[id]/reject */
export const rejectServiceListingSchema = z.object({
  reason: rejectionReasonSchema,
});

/** PATCH /api/services/providers/[userId] */
export const patchServiceProviderSchema = z.object({
  bio: z.string().max(500),
});
