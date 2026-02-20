import { z } from "zod";
import { notificationCategoryEnum } from "@/db/schemas/_enums";

/**
 * Zod schemas for push subscription and notification preference API payloads.
 * Extracted from route handlers so they can be tested independently and reused
 * on the client if needed.
 */

// ---- Push subscription schemas ----

export const subscribeBodySchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;

export const unsubscribeBodySchema = z.object({
  endpoint: z.string().min(1),
});

export type UnsubscribeBody = z.infer<typeof unsubscribeBodySchema>;

// ---- Notification preferences schema ----

const categoryToggleSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
});

const validCategories = notificationCategoryEnum.enumValues;
const categoryEnumSchema = z.enum(validCategories);

const masterToggleSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
});

/**
 * Schema for PATCH /api/notifications/preferences.
 * Accepts `{ master?: { email?, push? }, categories?: { bookings?: { email?, push? }, ... } }`.
 * Unknown category keys are stripped.
 */
export const patchPreferencesBodySchema = z.object({
  master: masterToggleSchema.optional(),
  categories: z
    .record(z.string(), categoryToggleSchema)
    .optional()
    .default({})
    .transform((rec) => {
      const filtered: Record<string, z.infer<typeof categoryToggleSchema>> = {};
      for (const [key, value] of Object.entries(rec ?? {})) {
        if (categoryEnumSchema.safeParse(key).success) {
          filtered[key] = value;
        }
      }
      return filtered;
    }),
});

export type PatchPreferencesBody = z.infer<typeof patchPreferencesBodySchema>;
