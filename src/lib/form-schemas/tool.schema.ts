import { z } from "zod";

export const toolConditionSchema = z.enum([
  "excellent",
  "good",
  "fair",
  "poor",
]);

// Base schema for tool creation
const baseToolSchema = z.object({
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
  specifications: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    )
    .default({}),
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
  deliveryFee: z.number().min(0, "Delivery fee cannot be negative").default(0),
  deliveryRadius: z
    .number()
    .min(0, "Delivery radius cannot be negative")
    .default(0),
});

// Helper function to add delivery validation to the schema
const withDeliveryValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (data) =>
        !data.deliveryAvailable ||
        (data.deliveryAvailable && data.deliveryFee > 0),
      {
        message: "Delivery fee is required when delivery is available",
        path: ["deliveryFee"],
      },
    )
    .refine(
      (data) =>
        !data.deliveryAvailable ||
        (data.deliveryAvailable && data.deliveryRadius > 0),
      {
        message: "Delivery radius is required when delivery is available",
        path: ["deliveryRadius"],
      },
    );

// Server schema = base + refinements
export const createToolSchemaServer = withDeliveryValidation(baseToolSchema);

// Schema for image uploads
export const imageFileSchema = z.object({
  file: z.any().optional(), // Using z.any() to avoid File instanceof check during SSR
  url: z.string().optional(),
  id: z.string().optional(),
  orderIndex: z.number().optional(),
});

// Client schema = base + images + delivery validation
export const createToolSchemaClient = withDeliveryValidation(
  baseToolSchema.extend({
    images: z.array(imageFileSchema).min(1, "At least one image is required"),
  }),
);

export type CreateToolFormDataClientType = z.infer<
  typeof createToolSchemaClient
>;
export type CreateToolFormDataServerType = z.infer<
  typeof createToolSchemaServer
>;
export type ImageFile = z.infer<typeof imageFileSchema>;
