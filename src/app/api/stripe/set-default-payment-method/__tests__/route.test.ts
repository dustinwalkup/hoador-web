import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

/**
 * The route calls `setDefaultPaymentMethod` (not the Stripe SDK directly),
 * scoped to the caller's own `stripeCustomerId`. Mocking the session module
 * (not route-helpers) keeps the real `getAuthenticatedUserResponse` —
 * including its actual 401 mapping — under test.
 */

const mockSetDefaultPaymentMethod = vi.fn();
vi.mock("@/services/stripe/payment-method", () => ({
  setDefaultPaymentMethod: (...a: unknown[]) =>
    mockSetDefaultPaymentMethod(...a),
}));

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
  requireAuth: vi.fn(),
  requireVerifiedUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const authedAs = (stripeCustomerId: string | null) => ({
  user: {
    id: "user-1",
    status: "active",
    emailVerified: true,
    userType: "standard",
    stripeCustomerId,
  },
  userId: "user-1",
  isAdmin: false,
});

const req = (body: unknown = { paymentMethodId: "pm_1" }) =>
  new NextRequest("http://localhost/api/stripe/set-default-payment-method", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/stripe/set-default-payment-method", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthenticatedUser.mockResolvedValue(authedAs("cus_1"));
  });

  it("401s without a session and never sets a default", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await POST(req());

    expect(res.status).toBe(401);
    expect(mockSetDefaultPaymentMethod).not.toHaveBeenCalled();
  });

  it("404s a caller with no Stripe customer", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(authedAs(null));

    const res = await POST(req());

    expect(res.status).toBe(404);
    expect(mockSetDefaultPaymentMethod).not.toHaveBeenCalled();
  });

  it("400s a missing paymentMethodId, without setting a default", async () => {
    const res = await POST(req({}));

    expect(res.status).toBe(400);
    expect(mockSetDefaultPaymentMethod).not.toHaveBeenCalled();
  });

  it("200s and sets the default with the caller's own customer/user ids", async () => {
    mockSetDefaultPaymentMethod.mockResolvedValue(undefined);

    const res = await POST(req({ paymentMethodId: "pm_1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockSetDefaultPaymentMethod).toHaveBeenCalledWith(
      "cus_1",
      "pm_1",
      "user-1",
    );
  });

  // ARCH-05: the Stripe SDK error goes through handleApiError's curated
  // mapping, never back to the client verbatim.
  it("500s a Stripe error with the curated message, not Stripe's raw text", async () => {
    mockSetDefaultPaymentMethod.mockRejectedValue(
      new Stripe.errors.StripeCardError({
        type: "card_error",
        code: "card_declined",
        message: "Raw Stripe decline text for req_leak",
      } as ConstructorParameters<typeof Stripe.errors.StripeCardError>[0]),
    );

    const res = await POST(req());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("The payment method was declined.");
    expect(JSON.stringify(body)).not.toContain("req_leak");
  });
});
