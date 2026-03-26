import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Client-side Zod schema for the service booking wizard (all steps).
 * Use `trigger` with a subset of field names on step 1; full schema runs on submit.
 *
 * @param isHourly - When true, `hours` must be a positive number string.
 * @returns Zod schema for booking form values
 */
export function createServiceBookingFormSchema(isHourly: boolean) {
  const hoursField = isHourly
    ? z
        .string()
        .min(1, "Please enter the number of hours needed.")
        .refine((v) => {
          const n = Number.parseFloat(v);
          return Number.isFinite(n) && n > 0;
        }, "Please enter the number of hours needed.")
    : z.string().optional();

  return z
    .object({
      proposedDate: z
        .string()
        .min(1, "Please select a date for your booking.")
        .regex(dateRegex, "Invalid date (use YYYY-MM-DD)"),
      proposedTime: z
        .string()
        .min(1, "Please select a time for your booking.")
        .max(32),
      hours: hoursField,
      notes: z
        .string()
        .max(5000, "Notes must be 5000 characters or less")
        .optional(),
      paymentMethodId: z.string().min(1, "Please select a payment method"),
    })
    .refine(
      (data) => {
        if (!data.proposedDate || !data.proposedTime) {
          return true;
        }
        const selectedDate = new Date(
          `${data.proposedDate}T${data.proposedTime}`,
        );
        if (Number.isNaN(selectedDate.getTime())) {
          return true;
        }
        return selectedDate >= new Date();
      },
      {
        message: "Please select a future date and time.",
        path: ["proposedDate"],
      },
    );
}

export type ServiceBookingFormValues = z.infer<
  ReturnType<typeof createServiceBookingFormSchema>
>;
