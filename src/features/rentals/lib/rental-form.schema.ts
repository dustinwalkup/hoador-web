import { z } from "zod";

/**
 * Client-side form schema for the multi-step rental booking form.
 * This schema handles validation for all steps: dates, delivery, payment, and summary.
 */
export const rentalFormSchema = z
  .object({
    startDate: z
      .date({
        message: "Start date is required",
      })
      .optional(),
    endDate: z
      .date({
        message: "End date is required",
      })
      .optional(),
    deliveryMethod: z.enum(["pickup", "delivery"], {
      message: "Please select a delivery method",
    }),
    deliveryStreet: z.string().optional(),
    deliveryCity: z.string().optional(),
    deliveryState: z.string().optional(),
    deliveryZip: z.string().optional(),
    deliveryInstructions: z
      .string()
      .max(500, "Delivery instructions must be 500 characters or less")
      .optional(),
    setupRequested: z.boolean(),
    message: z.string().optional(),
    paymentMethodId: z.string().optional(),
    // Legal document acknowledgements - single checkbox controls all policies
    rentalAgreementAccepted: z.boolean().refine((val) => val === true, {
      message:
        "You must accept the Rental Agreement and all policies to continue",
    }),
    cancellationRefundAcknowledged: z.boolean().optional(),
    safetyLiabilityPackageAccepted: z.boolean().optional(),
    paymentPayoutAccepted: z.boolean().optional(),
  })
  .refine(
    (data) =>
      !data.startDate || !data.endDate || data.endDate >= data.startDate,
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    },
  )
  .refine(
    (data) =>
      data.deliveryMethod === "pickup" ||
      (data.deliveryMethod === "delivery" &&
        data.deliveryStreet &&
        data.deliveryStreet.trim().length > 0),
    {
      message: "Street address is required when delivery is selected",
      path: ["deliveryStreet"],
    },
  )
  .refine(
    (data) =>
      data.deliveryMethod === "pickup" ||
      (data.deliveryMethod === "delivery" &&
        data.deliveryCity &&
        data.deliveryCity.trim().length > 0),
    {
      message: "City is required when delivery is selected",
      path: ["deliveryCity"],
    },
  )
  .refine(
    (data) =>
      data.deliveryMethod === "pickup" ||
      (data.deliveryMethod === "delivery" &&
        data.deliveryState &&
        data.deliveryState.trim().length > 0),
    {
      message: "State is required when delivery is selected",
      path: ["deliveryState"],
    },
  )
  .refine(
    (data) =>
      data.deliveryMethod === "pickup" ||
      (data.deliveryMethod === "delivery" &&
        data.deliveryZip &&
        data.deliveryZip.trim().length > 0),
    {
      message: "Zip code is required when delivery is selected",
      path: ["deliveryZip"],
    },
  )
  .refine(
    (data) => !data.setupRequested || data.deliveryMethod === "delivery",
    {
      message: "Setup service requires delivery to be selected",
      path: ["setupRequested"],
    },
  )
  .refine(
    (data) =>
      typeof data.paymentMethodId === "string" &&
      data.paymentMethodId.trim().length > 0,
    {
      message: "Please select a payment method",
      path: ["paymentMethodId"],
    },
  );

export type RentalFormData = z.infer<typeof rentalFormSchema>;

/**
 * Helper function to validate date range against minimum/maximum rental periods.
 * This is used for step-by-step validation in the form.
 */
export function validateDateRange(
  startDate: Date | undefined,
  endDate: Date | undefined,
  minimumRentalPeriod: number,
  maximumRentalPeriod: number,
): { isValid: boolean; error?: string } {
  if (!startDate || !endDate) {
    return {
      isValid: false,
      error: "Please select both start and end dates",
    };
  }

  if (endDate < startDate) {
    return {
      isValid: false,
      error: "End date must be on or after start date",
    };
  }

  const s = new Date(startDate);
  const e = new Date(endDate);
  s.setHours(12, 0, 0, 0);
  e.setHours(12, 0, 0, 0);
  const days =
    Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (days < minimumRentalPeriod) {
    return {
      isValid: false,
      error: `Minimum rental period is ${minimumRentalPeriod} day${
        minimumRentalPeriod !== 1 ? "s" : ""
      }. Please select a longer period.`,
    };
  }

  if (days > maximumRentalPeriod) {
    return {
      isValid: false,
      error: `Maximum rental period is ${maximumRentalPeriod} days. Please select a shorter period.`,
    };
  }

  return { isValid: true };
}
