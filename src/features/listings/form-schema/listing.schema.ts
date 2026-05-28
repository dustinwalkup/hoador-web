import { type input, type output, z } from "zod";

import {
  MINIMUM_LISTING_PRICE_USD,
  STRIPE_MINIMUM_CHARGE_USD,
} from "@/constants/payments";

/** Allows empty string while editing numeric inputs; output is always a number. */
const dailyRateFormField = z.preprocess(
  (val: unknown) => (val === undefined ? "" : val),
  z
    .union([z.literal(""), z.number()])
    .superRefine((val, ctx) => {
      if (val === "") {
        ctx.addIssue({
          code: "custom",
          message: "Daily rate is required",
        });
        return;
      }
      if (val < MINIMUM_LISTING_PRICE_USD) {
        ctx.addIssue({
          code: "custom",
          message: `Daily rate must be at least $${MINIMUM_LISTING_PRICE_USD}`,
        });
      }
    })
    .transform((val): number => {
      if (val === "") {
        throw new Error("invalid daily rate");
      }
      return val;
    }),
);

const securityDepositFormField = z
  .union([z.literal(""), z.number()])
  .transform((val) => (val === "" ? 0 : val))
  .pipe(
    z.number().refine((val) => val === 0 || val >= STRIPE_MINIMUM_CHARGE_USD, {
      message: `Security deposit must be $0 or at least $${STRIPE_MINIMUM_CHARGE_USD.toFixed(2)}`,
    }),
  )
  .default(0);

const minimumRentalPeriodFormField = z
  .union([z.literal(""), z.number()])
  .superRefine((val, ctx) => {
    if (val === "") {
      ctx.addIssue({
        code: "custom",
        message: "Minimum rental period is required",
      });
      return;
    }
    if (val < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Minimum rental period must be at least 1 day",
      });
    }
  })
  .transform((val): number => {
    if (val === "") {
      throw new Error("invalid minimum rental period");
    }
    return val;
  })
  .default(1);

const maximumRentalPeriodFormField = z
  .union([z.literal(""), z.number()])
  .superRefine((val, ctx) => {
    if (val === "") {
      ctx.addIssue({
        code: "custom",
        message: "Maximum rental period is required",
      });
      return;
    }
    if (val < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Maximum rental period must be at least 1 day",
      });
    }
  })
  .transform((val): number => {
    if (val === "") {
      throw new Error("invalid maximum rental period");
    }
    return val;
  })
  .default(30);

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
  dailyRate: dailyRateFormField,
  weeklyRate: z.number().min(0.01).optional(),
  monthlyRate: z.number().min(0.01).optional(),
  securityDeposit: securityDepositFormField,
  specifications: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    )
    .default({}),
  instructions: z.string().optional(),
  safetyNotes: z.string().optional(),
  minimumRentalPeriod: minimumRentalPeriodFormField,
  maximumRentalPeriod: maximumRentalPeriodFormField,
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
  status: z.enum(["processing", "ready", "error"]).optional(),
  errorMessage: z.string().optional(),
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

/** Parsed listing form values (API / submit). */
export type CreateListingFormDataClientType = output<
  typeof createListingSchemaClient
>;
/** Raw react-hook-form values (numeric fields may be "" while editing). */
export type CreateListingFormClientValues = input<
  typeof createListingSchemaClient
>;
export type CreateListingFormDataServerType = output<
  typeof createListingSchemaServer
>;
export type ImageFile = z.infer<typeof imageFileSchema>;
