import { z } from "zod";

export const createRentalRequestSchema = z
  .object({
    listingId: z.string().uuid("Invalid listing ID"),
    startDate: z.date({
      message: "Start date is required",
    }),
    endDate: z.date({
      message: "End date is required",
    }),
    deliveryRequested: z.boolean().default(false),
    deliveryAddress: z.string().optional(),
    deliveryInstructions: z.string().max(500).optional(),
    setupRequested: z.boolean().default(false),
    setupFee: z.number().default(0),
    message: z.string().optional(),
    paymentIntentId: z.string().optional(), // Stripe payment intent ID
    paymentMethodId: z.string().min(1, "Payment method is required"), // Stripe payment method ID
    // Legal document acknowledgements
    rentalAgreementAccepted: z.boolean().optional(),
    cancellationRefundAcknowledged: z.boolean().optional(),
    safetyLiabilityPackageAccepted: z.boolean().optional(),
    paymentPayoutAccepted: z.boolean().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
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
  )
  .refine((data) => !data.setupRequested || data.deliveryRequested, {
    message: "Setup service requires delivery to be selected",
    path: ["setupRequested"],
  });

export type CreateRentalRequestFormData = z.infer<
  typeof createRentalRequestSchema
>;
