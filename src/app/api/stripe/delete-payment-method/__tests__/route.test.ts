import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEC-07: the detach runs with the platform key, so the route itself must
 * prove the card is the caller's. A detached card can never be reused.
 */

// `services/stripe/server` throws at module load without a secret key.
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
});

const mockRetrieve = vi.fn();
vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    paymentMethods: { retrieve: (...a: unknown[]) => mockRetrieve(...a) },
  },
}));

const mockDetach = vi.fn();
vi.mock("@/services/stripe/payment-method", () => ({
  detachPaymentMethod: (...a: unknown[]) => mockDetach(...a),
}));

// Mock the session module, not route-helpers, so the real auth path runs.
const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getAuthenticatedUser: (...a: unknown[]) => mockGetAuthenticatedUser(...a),
  getCurrentUserId: vi.fn().mockResolvedValue("user-1"),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

const authedAs = (stripeCustomerId: string | null) => ({
  user: { id: "user-1", status: "active", stripeCustomerId },
  userId: "user-1",
  isAdmin: false,
});

const del = (id = "pm_1") =>
  new NextRequest(
    `http://localhost/api/stripe/delete-payment-method?id=${id}`,
    {
      method: "DELETE",
    },
  );

describe("DELETE /api/stripe/delete-payment-method (SEC-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(authedAs("cus_me"));
    mockDetach.mockResolvedValue(undefined);
  });

  it("detaches the caller's own card", async () => {
    mockRetrieve.mockResolvedValue({ id: "pm_1", customer: "cus_me" });

    const { DELETE } = await import("../route");
    const res = await DELETE(del());

    expect(res.status).toBe(200);
    expect(mockDetach).toHaveBeenCalledWith("pm_1");
  });

  it("accepts an expanded customer object", async () => {
    mockRetrieve.mockResolvedValue({ id: "pm_1", customer: { id: "cus_me" } });

    const { DELETE } = await import("../route");
    const res = await DELETE(del());

    expect(res.status).toBe(200);
    expect(mockDetach).toHaveBeenCalled();
  });

  it.each([
    ["another customer's card", { id: "pm_1", customer: "cus_victim" }],
    ["an unattached card", { id: "pm_1", customer: null }],
  ])("404s %s and never detaches", async (_label, pm) => {
    mockRetrieve.mockResolvedValue(pm);

    const { DELETE } = await import("../route");
    const res = await DELETE(del());

    expect(res.status).toBe(404);
    expect(mockDetach).not.toHaveBeenCalled();
  });

  it("404s an id Stripe doesn't know, the same as someone else's", async () => {
    mockRetrieve.mockRejectedValue(new Error("No such PaymentMethod"));

    const { DELETE } = await import("../route");
    const res = await DELETE(del("pm_nope"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Payment method not found" });
    expect(mockDetach).not.toHaveBeenCalled();
  });

  it("404s a caller with no Stripe customer, even for an unattached card", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(authedAs(null));
    mockRetrieve.mockResolvedValue({ id: "pm_1", customer: null });

    const { DELETE } = await import("../route");
    const res = await DELETE(del());

    expect(res.status).toBe(404);
    expect(mockDetach).not.toHaveBeenCalled();
  });

  it("doesn't echo Stripe's message when the detach fails", async () => {
    mockRetrieve.mockResolvedValue({ id: "pm_1", customer: "cus_me" });
    mockDetach.mockRejectedValue(new Error("Stripe internal detail"));

    const { DELETE } = await import("../route");
    const res = await DELETE(del());

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/internal detail/);
  });

  it("401s without a session and never reaches Stripe", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const res = await DELETE(del());

    expect(res.status).toBe(401);
    expect(mockRetrieve).not.toHaveBeenCalled();
  });
});
