import { z } from "zod";

export const createRentalRequestSchema = z
  .object({
    listingId: z.string().uuid("Invalid listing ID"),
    startDate: z.date({
      required_error: "Start date is required",
    }),
    endDate: z.date({
      required_error: "End date is required",
    }),
    deliveryRequested: z.boolean().default(false),
    deliveryAddress: z.string().optional(),
    selectedWindow: z.string().min(1, "Time window is required"),
    message: z.string().optional(),
    paymentIntentId: z.string().optional(), // Stripe payment intent ID
    paymentMethodId: z.string().optional(), // Stripe payment method ID
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine(
    (data) =>
      !data.deliveryRequested ||
      (data.deliveryRequested &&
        data.deliveryAddress &&
        data.deliveryAddress.trim().length > 0),
    {
      message: "Delivery address is required when delivery is requested",
      path: ["deliveryAddress"],
    },
  );

export type CreateRentalRequestFormData = z.infer<
  typeof createRentalRequestSchema
>;
