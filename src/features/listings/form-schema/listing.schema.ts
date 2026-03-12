import { z } from "zod";

export const listingConditionSchema = z.enum(["new", "good", "fair", "poor"]);

export const deliveryModeSchema = z.enum([
  "pickup_only",
  "delivery_only",
  "both_available",
]);

// Base schema for listing creation
const baseListingSchema = z.object({
  name: z.string().min(1, "Listing name is required").max(255),
  description: z.string().min(1, "Description is required").max(2000),
  categoryId: z.string().min(1, "Category is required"),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: listingConditionSchema,
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
  deliveryMode: deliveryModeSchema.default("pickup_only"),
  deliveryFee: z.number().min(0, "Delivery fee cannot be negative").default(0),
  deliveryRadius: z
    .number()
    .min(0, "Delivery radius cannot be negative")
    .default(0),
  setupAvailable: z.boolean().default(false),
  setupFee: z.number().min(0, "Setup fee cannot be negative").default(0),
});

// Helper function to add delivery and setup validation to the schema
const withServiceValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (data) => {
        const d = data as Record<string, unknown>;
        const deliveryMode = d.deliveryMode as string;
        const deliveryRadius = d.deliveryRadius as number;
        return (
          deliveryMode === "pickup_only" ||
          (deliveryMode !== "pickup_only" && deliveryRadius > 0)
        );
      },
      {
        message: "Delivery radius is required when delivery is available",
        path: ["deliveryRadius"],
      },
    )
    .refine(
      (data) => {
        const d = data as Record<string, unknown>;
        const deliveryMode = d.deliveryMode as string;
        return !d.setupAvailable || deliveryMode !== "pickup_only";
      },
      {
        message: "Setup service requires delivery to be available",
        path: ["setupAvailable"],
      },
    );

// Server schema = base + refinements (without ownerPoliciesAcknowledged)
export const createListingSchemaServer =
  withServiceValidation(baseListingSchema);

// Schema for image uploads
export const imageFileSchema = z.object({
  file: z.any().optional(), // Using z.any() to avoid File instanceof check during SSR
  url: z.string().optional(),
  id: z.string().optional(),
  orderIndex: z.number().optional(),
});

// Client schema = base + images + ownerPoliciesAcknowledged + service validation
export const createListingSchemaClient = withServiceValidation(
  baseListingSchema.extend({
    images: z
      .array(imageFileSchema)
      .min(1, "At least one image is required")
      .max(10, "Maximum 10 images allowed"),
    ownerPoliciesAcknowledged: z.boolean().refine((val) => val === true, {
      message: "You must acknowledge the Owner Policies to create a listing.",
    }),
  }),
);

export type CreateListingFormDataClientType = z.infer<
  typeof createListingSchemaClient
>;
export type CreateListingFormDataServerType = z.infer<
  typeof createListingSchemaServer
>;
export type ImageFile = z.infer<typeof imageFileSchema>;
