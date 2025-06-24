import { z } from "zod";

export const toolConditionSchema = z.enum([
  "excellent",
  "good",
  "fair",
  "poor",
]);

export const createToolSchema = z
  .object({
    name: z.string().min(1, "Tool name is required").max(255),
    description: z.string().min(1, "Description is required").max(2000),
    categoryId: z.string().min(1, "Category is required"),
    brand: z.string().optional(),
    model: z.string().optional(),
    condition: toolConditionSchema,
    dailyRate: z.number().min(0.01, "Daily rate must be greater than 0"),
    weeklyRate: z.number().min(0.01).optional(),
    monthlyRate: z.number().min(0.01).optional(),
    securityDeposit: z
      .number()
      .min(0, "Security deposit cannot be negative")
      .default(0),
    images: z.array(z.string()).min(1, "At least one image is required"),
    specifications: z.record(z.string(), z.string()).default({}),
    instructions: z.string().optional(),
    safetyNotes: z.string().optional(),
    minimumRentalPeriod: z
      .number()
      .min(1, "Minimum rental period must be at least 1 day")
      .default(1),
    maximumRentalPeriod: z
      .number()
      .min(1, "Maximum rental period must be at least 1 day")
      .default(30),
    requiresPickup: z.boolean().default(true),
    deliveryAvailable: z.boolean().default(false),
    deliveryFee: z
      .number()
      .min(0, "Delivery fee cannot be negative")
      .default(0),
    deliveryRadius: z
      .number()
      .min(0, "Delivery radius cannot be negative")
      .default(0),
  })
  .refine(
    (data) => {
      if (data.deliveryAvailable && data.deliveryFee === 0) {
        return false;
      }
      return true;
    },
    {
      message: "Delivery fee is required when delivery is available",
      path: ["deliveryFee"],
    },
  )
  .refine(
    (data) => {
      if (data.deliveryAvailable && data.deliveryRadius === 0) {
        return false;
      }
      return true;
    },
    {
      message: "Delivery radius is required when delivery is available",
      path: ["deliveryRadius"],
    },
  )
  .refine(
    (data) => {
      if (data.weeklyRate && data.weeklyRate > data.dailyRate * 7) {
        return false;
      }
      return true;
    },
    {
      message:
        "Weekly rate should be less than or equal to 7 times the daily rate to offer a discount",
      path: ["weeklyRate"],
    },
  )
  .refine(
    (data) => {
      if (data.monthlyRate && data.monthlyRate > data.dailyRate * 30) {
        return false;
      }
      return true;
    },
    {
      message:
        "Monthly rate should be less than or equal to 30 times the daily rate to offer a discount",
      path: ["monthlyRate"],
    },
  );

export type CreateToolFormData = z.infer<typeof createToolSchema>;
