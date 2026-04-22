import { z } from "zod";

export const createBlindReviewSchema = z
  .object({
    rentalId: z.string().uuid().optional(),
    serviceBookingId: z.string().uuid().optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (data) =>
      (data.rentalId || data.serviceBookingId) &&
      !(data.rentalId && data.serviceBookingId),
    { message: "Exactly one of rentalId or serviceBookingId is required" },
  );

export type CreateBlindReviewInput = z.infer<typeof createBlindReviewSchema>;
