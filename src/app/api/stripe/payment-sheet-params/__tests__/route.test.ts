import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Requirements: 2.3.1
 * Design: 2-design.md §4.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.3
 */

// The handler ignores its request (no body/params), but `withRequestLogging`
// types it as taking one.
const REQ = new NextRequest(
  "http://localhost/api/stripe/payment-sheet-params",
  {
    method: "POST",
  },
);

// `services/stripe/server` throws at module load without a secret key, and the
// vitest env does not define one.
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_dummy";
});

const mockEphemeralKeysCreate = vi.fn();
const mockSetupIntentsCreate = vi.fn();

// Only the client is stubbed — the API-version constant is the *real* one, so
// the assertion below compares against the shipped value rather than a copy of
// itself.
vi.mock("@/services/stripe/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/stripe/server")>();
  return {
    STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION:
      actual.STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION,
    PAYMENT_SERVER_INSTANCE: {
      ephemeralKeys: {
        create: (...a: unknown[]) => mockEphemeralKeysCreate(...a),
      },
      setupIntents: {
        create: (...a: unknown[]) => mockSetupIntentsCreate(...a),
      },
    },
  };
});

// Mocking the session module rather than route-helpers (per CLAUDE.md) keeps the
// real `getAuthenticatedUserResponse` — including its actual 401 mapping — under
// test.
const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

const mockGetOrCreateStripeCustomerId = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: {
    getOrCreateStripeCustomerId: (...a: unknown[]) =>
      mockGetOrCreateStripeCustomerId(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";
import { STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION } from "@/services/stripe/server";

describe("POST /api/stripe/payment-sheet-params", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_dummy";
    mockGetAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1", email: "renter@test.com" },
      userId: "user-1",
      isAdmin: false,
    });
    mockGetOrCreateStripeCustomerId.mockResolvedValue("cus_123");
    mockEphemeralKeysCreate.mockResolvedValue({ secret: "ek_secret_123" });
    mockSetupIntentsCreate.mockResolvedValue({
      client_secret: "seti_123_secret_456",
    });
  });

  it("returns every field the native PaymentSheet needs", async () => {
    const res = await POST(REQ);

    expect(res.status).toBe(200);
    // The app maps this 1:1 onto initPaymentSheet — a missing field is an
    // opaque failure on the device, not a server error.
    expect(await res.json()).toEqual({
      setupIntentClientSecret: "seti_123_secret_456",
      ephemeralKeySecret: "ek_secret_123",
      customerId: "cus_123",
      publishableKey: "pk_test_dummy",
    });
  });

  it("requires authentication", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await POST(REQ);

    expect(res.status).toBe(401);
    // No Stripe objects may be created for an unauthenticated caller.
    expect(mockGetOrCreateStripeCustomerId).not.toHaveBeenCalled();
    expect(mockEphemeralKeysCreate).not.toHaveBeenCalled();
    expect(mockSetupIntentsCreate).not.toHaveBeenCalled();
  });

  it("pins the ephemeral key to the mobile-compatible API version", async () => {
    await POST(REQ);

    expect(mockEphemeralKeysCreate).toHaveBeenCalledWith(
      { customer: "cus_123" },
      { apiVersion: STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION },
    );
    // Omitting the version entirely is the real failure mode — Stripe rejects
    // the call — so assert it is actually present in the options arg.
    expect(mockEphemeralKeysCreate.mock.calls[0][1]).toHaveProperty(
      "apiVersion",
    );
  });

  it("uses an API version at or above Stripe's documented floor for mobile", async () => {
    // Independent of what the constant happens to say: Stripe requires
    // >= 2020-03-02 for ephemeral keys, and stripe-android reports exactly that
    // while stripe-ios reports 2020-08-27. A version below the floor breaks the
    // PaymentSheet on device with nothing failing in CI.
    expect(
      Date.parse(STRIPE_MOBILE_EPHEMERAL_KEY_API_VERSION),
    ).toBeGreaterThanOrEqual(Date.parse("2020-03-02"));
  });

  it("creates the SetupIntent off-session against the same customer", async () => {
    await POST(REQ);

    expect(mockSetupIntentsCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      // Cards are charged later with the customer absent (approve/accept), so
      // an on-session mandate would fail at charge time.
      usage: "off_session",
    });
  });

  it("reuses an existing Stripe customer rather than creating a second one", async () => {
    // getOrCreateStripeCustomerId owns the reuse; this asserts the route always
    // routes through it and never mints its own customer.
    await POST(REQ);
    await POST(REQ);

    expect(mockGetOrCreateStripeCustomerId).toHaveBeenCalledTimes(2);
    expect(mockGetOrCreateStripeCustomerId).toHaveBeenCalledWith("user-1");
    const customers = [
      mockEphemeralKeysCreate.mock.calls.map((c) => c[0].customer),
      mockSetupIntentsCreate.mock.calls.map((c) => c[0].customer),
    ].flat();
    expect(new Set(customers)).toEqual(new Set(["cus_123"]));
  });

  it("scopes the ephemeral key and SetupIntent to the same customer", async () => {
    // A mismatch would hand the device a key for one customer and an intent for
    // another — PaymentSheet would save the card to the wrong Stripe customer.
    await POST(REQ);

    expect(mockEphemeralKeysCreate.mock.calls[0][0].customer).toBe(
      mockSetupIntentsCreate.mock.calls[0][0].customer,
    );
  });

  it("fails when the publishable key is not configured", async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    const res = await POST(REQ);

    expect(res.status).toBe(500);
    // Better to fail here than to hand the app a params blob with an undefined
    // key and let PaymentSheet fail cryptically on the device.
    expect(mockEphemeralKeysCreate).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the customer lookup fails",
      () =>
        mockGetOrCreateStripeCustomerId.mockRejectedValue(new Error("db down")),
    ],
    [
      "the ephemeral key cannot be created",
      () => mockEphemeralKeysCreate.mockRejectedValue(new Error("stripe down")),
    ],
    [
      "the setup intent cannot be created",
      () => mockSetupIntentsCreate.mockRejectedValue(new Error("stripe down")),
    ],
  ])("returns 500 when %s", async (_label, arrange) => {
    arrange();

    const res = await POST(REQ);

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
  });
});
