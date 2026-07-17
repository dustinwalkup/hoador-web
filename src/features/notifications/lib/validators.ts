import { z } from "zod";
import { Expo } from "expo-server-sdk";
import { notificationCategoryEnum } from "@/db/schemas/_enums";

/**
 * Zod schemas for push subscription and notification preference API payloads.
 * Extracted from route handlers so they can be tested independently and reused
 * on the client if needed.
 */

// ---- Push subscription schemas ----

/**
 * Browser Web Push subscription — the original shape. Unchanged: the PWA posts
 * this exact body today and must keep working until the post-GA web-push
 * decommission (Requirement 2.2.7).
 */
export const webSubscribeBodySchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

/**
 * Native (Expo) push subscription posted by the mobile app.
 *
 * `Expo.isExpoPushToken` is the authority on token format rather than a local
 * regex — it is the same check the send path applies, so a token accepted here
 * cannot be rejected at send time.
 */
export const nativeSubscribeBodySchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().refine((t) => Expo.isExpoPushToken(t), {
    message: "Invalid Expo push token",
  }),
});

/**
 * `POST /api/push/subscribe` accepts either shape. Discriminating on the
 * presence of `platform` (rather than a `z.discriminatedUnion`) keeps the web
 * body free of a discriminator field it has never sent.
 * Requirements: 2.2.1. Spec: epic-02-backend-services.md § 2.1.
 */
export const subscribeBodySchema = z.union([
  nativeSubscribeBodySchema,
  webSubscribeBodySchema,
]);

export type WebSubscribeBody = z.infer<typeof webSubscribeBodySchema>;
export type NativeSubscribeBody = z.infer<typeof nativeSubscribeBodySchema>;
export type SubscribeBody = z.infer<typeof subscribeBodySchema>;

/** Narrows a parsed subscribe body to the native branch. */
export function isNativeSubscribeBody(
  body: SubscribeBody,
): body is NativeSubscribeBody {
  return "platform" in body;
}

/**
 * `DELETE /api/push/subscribe` accepts either an `endpoint` (web) or a `token`
 * (native) — exactly one. Sign-out on mobile deactivates by token.
 */
export const unsubscribeBodySchema = z
  .object({
    endpoint: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
  })
  .refine((b) => Boolean(b.endpoint) !== Boolean(b.token), {
    message: "Exactly one of endpoint or token is required",
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
