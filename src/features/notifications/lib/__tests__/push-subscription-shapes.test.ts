import { describe, it, expect } from "vitest";
import {
  subscribeBodySchema,
  unsubscribeBodySchema,
  isNativeSubscribeBody,
} from "../validators";
import {
  isWebSubscriptionRow,
  isNativeSubscriptionRow,
  type PushSubscriptionRow,
} from "@/dal/notifications.dal";

/**
 * `push_subscriptions.p256dh` and `.auth` were `NOT NULL` until native push
 * landed; an Expo token has no VAPID keypair, so the column constraint had to
 * be relaxed (migration 0067). The web-vs-native invariant therefore lives in
 * code now, and these tests are what enforce it — the database no longer will.
 *
 * Requirements: 2.2.1
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md (F1, D-E2-1)
 */

const EXPO_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

const webBody = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "BNcRdreALRF", auth: "tBHItq" },
};

const row = (over: Partial<PushSubscriptionRow>): PushSubscriptionRow => ({
  id: "sub-1",
  userId: "user-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  p256dh: "BNcRdreALRF",
  auth: "tBHItq",
  platform: "web",
  token: null,
  userAgent: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe("subscribeBodySchema — the two accepted shapes", () => {
  it("accepts the web shape and narrows it as non-native", () => {
    const parsed = subscribeBodySchema.safeParse(webBody);
    expect(parsed.success).toBe(true);
    expect(isNativeSubscribeBody(parsed.data!)).toBe(false);
  });

  it.each(["ios", "android"] as const)("accepts the %s shape", (platform) => {
    const parsed = subscribeBodySchema.safeParse({
      platform,
      token: EXPO_TOKEN,
    });
    expect(parsed.success).toBe(true);
    expect(isNativeSubscribeBody(parsed.data!)).toBe(true);
  });

  it("accepts a bare-UUID Expo token", () => {
    // Expo's own isExpoPushToken accepts this legacy form; the subscribe
    // endpoint must not be stricter than the send path, or a device could
    // register successfully and then never be sendable (or vice versa).
    const parsed = subscribeBodySchema.safeParse({
      platform: "android",
      token: "f5e0ab4a-8b1c-4d2e-9a3f-6c7d8e9f0a1b",
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    ["a malformed Expo token", { platform: "ios", token: "abc123" }],
    ["a web-push endpoint as a token", { platform: "ios", token: "https://x" }],
    ["an unsupported platform", { platform: "web", token: EXPO_TOKEN }],
    ["a native body with no token", { platform: "ios" }],
    ["a web body with no keys", { endpoint: "https://fcm.example/x" }],
    [
      "a web body missing p256dh",
      { endpoint: "https://fcm.example/x", keys: { auth: "a" } },
    ],
    ["an empty object", {}],
  ])("rejects %s", (_label, body) => {
    expect(subscribeBodySchema.safeParse(body).success).toBe(false);
  });

  it("keeps the web body's optional expirationTime working (regression)", () => {
    const parsed = subscribeBodySchema.safeParse({
      ...webBody,
      expirationTime: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("unsubscribeBodySchema — exactly one identifier", () => {
  it.each([
    ["an endpoint alone", { endpoint: "https://fcm.example/x" }],
    ["a token alone", { token: EXPO_TOKEN }],
  ])("accepts %s", (_label, body) => {
    expect(unsubscribeBodySchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ["both", { endpoint: "https://fcm.example/x", token: EXPO_TOKEN }],
    ["neither", {}],
  ])("rejects %s", (_label, body) => {
    expect(unsubscribeBodySchema.safeParse(body).success).toBe(false);
  });
});

describe("row narrowing — the invariant the DB stopped enforcing", () => {
  it("narrows a well-formed web row", () => {
    expect(isWebSubscriptionRow(row({}))).toBe(true);
    expect(isNativeSubscriptionRow(row({}))).toBe(false);
  });

  it.each(["ios", "android"] as const)("narrows a %s row", (platform) => {
    const native = row({
      platform,
      token: EXPO_TOKEN,
      p256dh: null,
      auth: null,
    });
    expect(isNativeSubscriptionRow(native)).toBe(true);
    expect(isWebSubscriptionRow(native)).toBe(false);
  });

  it.each([
    ["p256dh", row({ p256dh: null })],
    ["auth", row({ auth: null })],
  ])(
    "rejects a web row with a null %s rather than sending a malformed push",
    (_label, corrupt) => {
      // Only reachable now that the column is nullable. A row like this is
      // corrupt, not native — the send path must skip it, never coerce it.
      expect(isWebSubscriptionRow(corrupt)).toBe(false);
      expect(isNativeSubscriptionRow(corrupt)).toBe(false);
    },
  );

  it("rejects a native row with no token", () => {
    const corrupt = row({
      platform: "ios",
      token: null,
      p256dh: null,
      auth: null,
    });
    expect(isNativeSubscriptionRow(corrupt)).toBe(false);
    expect(isWebSubscriptionRow(corrupt)).toBe(false);
  });
});
