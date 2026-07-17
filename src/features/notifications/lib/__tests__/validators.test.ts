import { describe, it, expect } from "vitest";
import {
  subscribeBodySchema,
  webSubscribeBodySchema,
  unsubscribeBodySchema,
  patchPreferencesBodySchema,
} from "../validators";

describe("subscribeBodySchema", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: { p256dh: "BNcRdreALRF...", auth: "tBHItq..." },
  };

  it("accepts a valid subscription with required fields", () => {
    const result = subscribeBodySchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ...valid, expirationTime: undefined });
  });

  // `subscribeBodySchema` became a web|native union when native push landed
  // (Requirement 2.2.1), so `expirationTime` is no longer on the union type.
  // These two assert the web branch specifically — parsing still goes through
  // the union above.
  it("accepts optional expirationTime as number", () => {
    const result = webSubscribeBodySchema.safeParse({
      ...valid,
      expirationTime: 1234567890,
    });
    expect(result.success).toBe(true);
    expect(result.data?.expirationTime).toBe(1234567890);
  });

  it("accepts expirationTime as null", () => {
    const result = webSubscribeBodySchema.safeParse({
      ...valid,
      expirationTime: null,
    });
    expect(result.success).toBe(true);
    expect(result.data?.expirationTime).toBeNull();
  });

  it("rejects missing endpoint", () => {
    const result = subscribeBodySchema.safeParse({ keys: valid.keys });
    expect(result.success).toBe(false);
  });

  it("rejects empty endpoint", () => {
    const result = subscribeBodySchema.safeParse({ ...valid, endpoint: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing keys", () => {
    const result = subscribeBodySchema.safeParse({ endpoint: valid.endpoint });
    expect(result.success).toBe(false);
  });

  it("rejects missing keys.p256dh", () => {
    const result = subscribeBodySchema.safeParse({
      endpoint: valid.endpoint,
      keys: { auth: "tBHItq..." },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing keys.auth", () => {
    const result = subscribeBodySchema.safeParse({
      endpoint: valid.endpoint,
      keys: { p256dh: "BNcRdreALRF..." },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty keys.p256dh", () => {
    const result = subscribeBodySchema.safeParse({
      endpoint: valid.endpoint,
      keys: { p256dh: "", auth: "tBHItq..." },
    });
    expect(result.success).toBe(false);
  });

  it("rejects null body", () => {
    expect(subscribeBodySchema.safeParse(null).success).toBe(false);
  });

  it("rejects non-object body", () => {
    expect(subscribeBodySchema.safeParse("string").success).toBe(false);
  });
});

describe("unsubscribeBodySchema", () => {
  it("accepts a valid endpoint", () => {
    const result = unsubscribeBodySchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty endpoint", () => {
    expect(unsubscribeBodySchema.safeParse({ endpoint: "" }).success).toBe(
      false,
    );
  });

  it("rejects missing endpoint", () => {
    expect(unsubscribeBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-string endpoint", () => {
    expect(unsubscribeBodySchema.safeParse({ endpoint: 123 }).success).toBe(
      false,
    );
  });

  it("rejects null body", () => {
    expect(unsubscribeBodySchema.safeParse(null).success).toBe(false);
  });
});

describe("patchPreferencesBodySchema", () => {
  it("accepts valid category toggles", () => {
    const result = patchPreferencesBodySchema.safeParse({
      categories: {
        bookings: { email: false, push: true },
        payments: { push: false },
      },
    });
    expect(result.success).toBe(true);
    expect(result.data?.categories).toEqual({
      bookings: { email: false, push: true },
      payments: { push: false },
    });
  });

  it("strips unknown category keys", () => {
    const result = patchPreferencesBodySchema.safeParse({
      categories: {
        bookings: { email: true },
        unknown_cat: { email: false },
      },
    });
    expect(result.success).toBe(true);
    expect(result.data?.categories).toEqual({
      bookings: { email: true },
    });
  });

  it("accepts an empty categories object", () => {
    const result = patchPreferencesBodySchema.safeParse({ categories: {} });
    expect(result.success).toBe(true);
    expect(result.data?.categories).toEqual({});
  });

  it("accepts all valid categories", () => {
    const result = patchPreferencesBodySchema.safeParse({
      categories: {
        bookings: { email: true, push: true },
        payments: { email: false, push: false },
        messages: { email: true },
        disputes: { push: false },
        reminders: { email: false, push: true },
      },
    });
    expect(result.success).toBe(true);
    expect(Object.keys(result.data!.categories)).toHaveLength(5);
  });

  it("accepts empty body (no-op)", () => {
    const result = patchPreferencesBodySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.master).toBeUndefined();
    expect(result.data?.categories).toEqual({});
  });

  it("accepts body with only master", () => {
    const result = patchPreferencesBodySchema.safeParse({
      master: { email: false, push: true },
    });
    expect(result.success).toBe(true);
    expect(result.data?.master).toEqual({ email: false, push: true });
    expect(result.data?.categories).toEqual({});
  });

  it("rejects categories as non-object", () => {
    expect(
      patchPreferencesBodySchema.safeParse({ categories: "all" }).success,
    ).toBe(false);
  });

  it("rejects non-boolean toggle values", () => {
    const result = patchPreferencesBodySchema.safeParse({
      categories: { bookings: { email: "yes" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects null body", () => {
    expect(patchPreferencesBodySchema.safeParse(null).success).toBe(false);
  });
});
