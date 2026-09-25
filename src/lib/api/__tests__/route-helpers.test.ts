import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  requireAuthResponse,
  requireAdminResponse,
  parseFormData,
  getAuthenticatedUserResponse,
  UnauthorizedError,
} from "../route-helpers";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  DALError,
  ServiceBookingPaymentFailedError,
  RentalRequestNotPendingError,
  RentalDatesUnavailableError,
  CounterpartyUnavailableError,
  BookingStartPassedError,
  ServiceNotYetDueError,
  NeedLimitReachedError,
  RateLimitedError,
  SubscriptionLimitReachedError,
  VisibilityPrimaryLockedError,
  ListingNotBookableError,
  ListingArchivedError,
  ListingNotApprovedError,
  CommunityNotVisibleError,
} from "@/dal/errors";
import { AccountDeletionBlockedError } from "@/features/users/lib/account-deletion-errors";
import { mockVerifiedUser, mockAdminUser } from "@/test/fixtures/auth";

// Mock the auth utilities
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  requireAuth: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@sentry/nextjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/nextjs")>()),
  captureException: vi.fn(),
}));

import {
  getCurrentUser,
  getAuthenticatedUser,
} from "@/features/auth/utils/session";
import { requireAdmin } from "@/features/auth/utils/guards";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";

type StripeRaw = ConstructorParameters<typeof Stripe.errors.StripeError>[0];

describe("route-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getCurrentUser to return a Promise that resolves to null
    // This prevents errors when handleApiError tries to set user context
    vi.mocked(getCurrentUser).mockResolvedValue(null);
  });

  describe("handleApiError", () => {
    it("should not leak a raw DB/Stripe error message on an unclassified 500 (SEC-16)", async () => {
      const leaked =
        'Failed query: select * from "user" where email = $1\nparams: ["x@example.com"]';
      const response = handleApiError(new Error(leaked));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("An unexpected error occurred");
      expect(JSON.stringify(body)).not.toContain("Failed query");
      expect(JSON.stringify(body)).not.toContain("params:");
    });

    // ARCH-05: raw Stripe SDK errors get the curated payment message, never
    // the SDK's own text (which can name request params, keys or accounts).
    it("maps a StripeCardError to its curated message at 500, not the raw SDK message", async () => {
      const error = new Stripe.errors.StripeCardError({
        type: "card_error",
        code: "insufficient_funds",
        message: "Your card has insufficient funds.", // Stripe's own raw text
      } as StripeRaw);

      const response = handleApiError(error);

      expect(response.status).toBe(500);
      expect((await response.json()).error).toBe(
        "Insufficient funds on the payment method.",
      );
    });

    it("maps a StripeInvalidRequestError to a safe message, never the raw SDK text", async () => {
      const error = new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        message: 'No such PaymentMethod: "pm_leaked_internal_detail"',
      } as StripeRaw);

      const response = handleApiError(error);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).not.toContain("pm_leaked_internal_detail");
    });

    it("never returns the raw text of a Stripe subclass getPaymentErrorMessage doesn't map", async () => {
      const error = new Stripe.errors.StripePermissionError({
        type: "invalid_request_error",
        message:
          "The provided key 'rk_live_leak' does not have access to account 'acct_leak'",
      } as StripeRaw);

      const body = await handleApiError(error).json();

      expect(body.error).toBe("Payment service error. Please try again.");
    });

    it("should handle UnauthorizedError with 401 status", () => {
      const error = new UnauthorizedError("Not authorized");
      const response = handleApiError(error);

      expect(response.status).toBe(401);
      expect(response).toBeInstanceOf(NextResponse);
    });

    // BIZ-01: a client refreshes the request on this code instead of parsing
    // the message, so it must survive (the generic ConflictError branch drops it).
    it("should give RentalRequestNotPendingError a 409 with its code", async () => {
      const response = handleApiError(new RentalRequestNotPendingError());

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        code: "REQUEST_NOT_PENDING",
      });
    });

    // CONC-01: the quote blocker code clients already branch on, so it must
    // survive the same way.
    it("should give RentalDatesUnavailableError a 409 with its code", async () => {
      const response = handleApiError(new RentalDatesUnavailableError());

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        code: "DATES_UNAVAILABLE",
      });
    });

    // Refused approvals and not-yet-due completions are expected user
    // outcomes, not incidents — in production they must not reach Sentry.
    describe("Sentry capture in production", () => {
      beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
      });
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it.each([
        ["RentalRequestNotPendingError", new RentalRequestNotPendingError()],
        ["RentalDatesUnavailableError", new RentalDatesUnavailableError()],
        ["ServiceNotYetDueError", new ServiceNotYetDueError()],
        ["NeedLimitReachedError", new NeedLimitReachedError("limit")],
        ["RateLimitedError", new RateLimitedError(30)],
        [
          "SubscriptionLimitReachedError",
          new SubscriptionLimitReachedError("cap"),
        ],
        ["VisibilityPrimaryLockedError", new VisibilityPrimaryLockedError()],
        ["ListingNotBookableError", new ListingNotBookableError()],
        ["ListingArchivedError", new ListingArchivedError()],
        ["ListingNotApprovedError", new ListingNotApprovedError()],
        ["CommunityNotVisibleError", new CommunityNotVisibleError()],
        ["BookingStartPassedError", new BookingStartPassedError("late")],
        [
          "StripeCardError",
          new Stripe.errors.StripeCardError({
            type: "card_error",
            code: "card_declined",
            message: "Your card was declined.",
          } as StripeRaw),
        ],
      ])("does not capture %s", (_name, error) => {
        handleApiError(error);

        expect(Sentry.captureException).not.toHaveBeenCalled();
      });

      it("still captures an unexpected error", () => {
        handleApiError(new Error("boom"));

        expect(Sentry.captureException).toHaveBeenCalled();
      });
    });

    // BIZ-02: a client can explain the wait on this code; the generic
    // ConflictError branch would drop it.
    it("should give ServiceNotYetDueError a 409 with its code", async () => {
      const response = handleApiError(new ServiceNotYetDueError());

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: expect.stringContaining("hasn't happened yet"),
        code: "SERVICE_NOT_YET_DUE",
      });
    });

    // BIZ-07: the approve/accept routes return this code when the other party
    // has deleted their account; it must survive like REQUEST_NOT_PENDING.
    it("should give CounterpartyUnavailableError a 409 with its code", async () => {
      const response = handleApiError(new CounterpartyUnavailableError());

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        code: "COUNTERPARTY_UNAVAILABLE",
      });
    });

    // BIZ-10: approve/accept after the booking's start.
    it("should give BookingStartPassedError a 409 with its code", async () => {
      const response = handleApiError(new BookingStartPassedError("late"));

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: "late",
        code: "BOOKING_START_PASSED",
      });
    });

    // SEC-15: the posting throttle; mobile classifies any 429 as rate-limited.
    it("should give NeedLimitReachedError a 429 with its code", async () => {
      const response = handleApiError(
        new NeedLimitReachedError("You can post up to 10 a day."),
      );

      expect(response.status).toBe(429);
      await expect(response.json()).resolves.toEqual({
        error: "You can post up to 10 a day.",
        code: "NEED_LIMIT_REACHED",
      });
    });

    // Mobile P-E14-6: the visibility screen branches on this code.
    it("should give VisibilityPrimaryLockedError a 400 with its code", async () => {
      const response = handleApiError(new VisibilityPrimaryLockedError());

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "You can't hide your home community.",
        code: "VISIBILITY_PRIMARY_LOCKED",
      });
    });

    // BIZ-08: the same codes the quote endpoints return as blockers, re-raised
    // at create/approve/accept.
    it.each([
      [new ListingNotBookableError(), "LISTING_NOT_BOOKABLE"],
      [new ListingArchivedError(), "LISTING_ARCHIVED"],
      [new ListingNotApprovedError(), "LISTING_NOT_APPROVED"],
      [new CommunityNotVisibleError(), "COMMUNITY_NOT_VISIBLE"],
    ])("should give %s a 409 with code %s", async (error, code) => {
      const response = handleApiError(error);

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: error.message,
        code,
      });
    });

    // ARCH-07: a durable per-key limit; Retry-After is the remaining window.
    it("should give RateLimitedError a 429 with its code and Retry-After", async () => {
      const response = handleApiError(new RateLimitedError(42));

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
      await expect(response.json()).resolves.toEqual({
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
      });
    });

    // SEC-13: the standing cap on active push subscriptions.
    it("should give SubscriptionLimitReachedError a 429 with its code", async () => {
      const response = handleApiError(
        new SubscriptionLimitReachedError("Up to 10."),
      );

      expect(response.status).toBe(429);
      await expect(response.json()).resolves.toEqual({
        error: "Up to 10.",
        code: "SUBSCRIPTION_LIMIT_REACHED",
      });
    });

    it("should handle NotFoundError with 404 status", () => {
      const error = new NotFoundError("Listing", "123");
      const response = handleApiError(error);

      expect(response.status).toBe(404);
    });

    it("should handle ValidationError with 400 status and details", () => {
      const error = new ValidationError("Invalid input", "email");
      const response = handleApiError(error);

      expect(response.status).toBe(400);
    });

    it("should give ServiceBookingPaymentFailedError a machine-readable code", async () => {
      // The class has carried this code since it was written and the body used
      // to drop it, leaving `paymentFailed` as the only signal — and a human
      // message in `error`, which mobile is forbidden to branch on (P-E9-6).
      const response = handleApiError(
        new ServiceBookingPaymentFailedError("Your card was declined."),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("SERVICE_BOOKING_PAYMENT_FAILED");
      // Both retained: `paymentFailed` is what the web surfaces already read,
      // and `error` is still the message a user sees.
      expect(body.paymentFailed).toBe(true);
      expect(body.error).toBe("Your card was declined.");
    });

    it("should handle ConflictError with 409 status", () => {
      const error = new ConflictError("Resource already exists");
      const response = handleApiError(error);

      expect(response.status).toBe(409);
    });

    it("should handle AccountDeletionBlockedError with 409 and a blockers list", async () => {
      const blockers = [
        {
          type: "open_disputes" as const,
          count: 2,
          message: "2 open disputes.",
        },
      ];
      const response = handleApiError(
        new AccountDeletionBlockedError({ blockers }),
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      // The app branches on this stable code and renders `blockers`.
      expect(body).toEqual({ error: "ACCOUNT_DELETION_BLOCKED", blockers });
    });

    it("should handle DALError with custom status code", () => {
      const error = new DALError("Custom error", "CUSTOM", 422);
      const response = handleApiError(error);

      expect(response.status).toBe(422);
    });

    it("should handle standard Error with 'not found' message as 404", () => {
      const error = new Error("Resource not found");
      const response = handleApiError(error);

      expect(response.status).toBe(404); // Errors with "not found" are treated as 404
    });

    it("should handle standard Error with 'Unauthorized' message as 401", () => {
      const error = new Error("Unauthorized access");
      const response = handleApiError(error);

      expect(response.status).toBe(401);
    });

    it("should handle standard Error with 'Authentication' message as 401", () => {
      const error = new Error("Authentication required");
      const response = handleApiError(error);

      expect(response.status).toBe(401);
    });

    it("should handle unknown errors with 500 status", () => {
      const error = { message: "Unknown error" };
      const response = handleApiError(error);

      expect(response.status).toBe(500);
    });

    it("should handle null/undefined errors with 500 status", () => {
      const response = handleApiError(null);

      expect(response.status).toBe(500);
    });

    it("should include error message in response", async () => {
      const error = new ValidationError("Invalid email format");
      const response = handleApiError(error);
      const json = await response.json();

      expect(json.error).toBe("Invalid email format");
    });

    it("should include details for ValidationError", async () => {
      const error = new ValidationError("Invalid input", "email");
      const response = handleApiError(error);
      const json = await response.json();

      expect(json.details).toEqual({ field: "email" });
    });
  });

  describe("requireAuthResponse", () => {
    it("should return null when user is authenticated", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        user: mockVerifiedUser,
        userId: "verified-user-123",
        isAdmin: false,
      });

      const result = await requireAuthResponse();

      expect(result).toBeNull();
    });

    it("should return 401 response when user is not authenticated", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      const result = await requireAuthResponse();

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);

      const json = await result!.json();
      expect(json.error).toBe("Authentication required");
    });
  });

  describe("requireAdminResponse", () => {
    it("should return null when user is admin", async () => {
      vi.mocked(requireAdmin).mockResolvedValue({
        id: "admin-123",
        userType: "admin",
      } as any);

      const result = await requireAdminResponse();

      expect(result).toBeNull();
    });

    it("should return 403 response when user is not admin", async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new Error("Admin privileges required"),
      );

      const result = await requireAdminResponse();

      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);

      const json = await result!.json();
      expect(json.error).toBe("Admin privileges required");
    });

    it("should return 401 response when user is not authenticated", async () => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new Error("Authentication required"),
      );

      const result = await requireAdminResponse();

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);

      const json = await result!.json();
      expect(json.error).toBe("Authentication required");
    });
  });

  describe("parseFormData", () => {
    it("should parse JSON request body", async () => {
      const data = { name: "Test", email: "test@example.com" };
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await parseFormData(request);

      expect(result).toEqual(data);
    });

    it("should parse FormData request body", async () => {
      const formData = new FormData();
      formData.append("name", "Test");
      formData.append("email", "test@example.com");

      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        body: formData,
      });

      const result = await parseFormData(request);

      expect(result.name).toBe("Test");
      expect(result.email).toBe("test@example.com");
    });

    it("should parse URL-encoded FormData", async () => {
      const body = new URLSearchParams({
        name: "Test",
        email: "test@example.com",
      });

      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const result = await parseFormData(request);

      expect(result.name).toBe("Test");
      expect(result.email).toBe("test@example.com");
    });

    it("should handle multiple values for same key (arrays)", async () => {
      const formData = new FormData();
      formData.append("tags", "tag1");
      formData.append("tags", "tag2");
      formData.append("tags", "tag3");

      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        body: formData,
      });

      const result = await parseFormData(request);

      expect(Array.isArray(result.tags)).toBe(true);
      expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
    });

    it("should handle boolean values from FormData", async () => {
      const formData = new FormData();
      formData.append("active", "true");
      formData.append("verified", "false");

      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        body: formData,
      });

      const result = await parseFormData(request);

      expect(result.active).toBe("true"); // FormData values are strings
      expect(result.verified).toBe("false");
    });

    it("should throw ValidationError for invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json{",
      });

      await expect(parseFormData(request)).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for unsupported content type", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "some text",
      });

      await expect(parseFormData(request)).rejects.toThrow(ValidationError);
    });

    it("should fallback to JSON parsing when content type is missing", async () => {
      const data = { name: "Test" };
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        body: JSON.stringify(data),
      });

      const result = await parseFormData(request);

      expect(result).toEqual(data);
    });

    it("should handle empty FormData", async () => {
      const formData = new FormData();

      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        body: formData,
      });

      const result = await parseFormData(request);

      expect(result).toEqual({});
    });

    it("should handle empty JSON body", async () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const result = await parseFormData(request);

      expect(result).toEqual({});
    });
  });

  describe("getAuthenticatedUserResponse", () => {
    it("should return user data when authenticated", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        user: mockVerifiedUser,
        userId: "verified-user-123",
        isAdmin: false,
      });

      const result = await getAuthenticatedUserResponse();

      expect(result).not.toBeInstanceOf(Response);
      if (!(result instanceof Response)) {
        expect(result.user).toEqual(mockVerifiedUser);
        expect(result.userId).toBe("verified-user-123");
        expect(result.isAdmin).toBe(false);
      }
    });

    it("should return user data with isAdmin true for admin user", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        user: mockAdminUser,
        userId: "admin-user-123",
        isAdmin: true,
      });

      const result = await getAuthenticatedUserResponse();

      expect(result).not.toBeInstanceOf(Response);
      if (!(result instanceof Response)) {
        expect(result.user).toEqual(mockAdminUser);
        expect(result.userId).toBe("admin-user-123");
        expect(result.isAdmin).toBe(true);
      }
    });

    it("should return 401 response when user is not authenticated", async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      const result = await getAuthenticatedUserResponse();

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);

        const json = await result.json();
        expect(json.error).toBe("Your session expired. Please sign in again.");
      }
    });
  });

  /**
   * SEC-01: admin suspension (and self-deactivation) must stop the API. Both
   * helpers 403 a restricted account unless the route opts it in; the
   * onboarding statuses are a funnel, not a sanction, and pass through.
   */
  describe("account status gate (SEC-01)", () => {
    const as = (status: string | undefined) =>
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        user: { ...mockVerifiedUser, status } as typeof mockVerifiedUser,
        userId: "verified-user-123",
        isAdmin: false,
      });

    describe.each([
      ["suspended", "ACCOUNT_SUSPENDED"],
      ["inactive", "ACCOUNT_INACTIVE"],
    ])("a %s account", (status, code) => {
      it("gets a 403 with its code from getAuthenticatedUserResponse", async () => {
        as(status);

        const result = await getAuthenticatedUserResponse();

        expect(result).toBeInstanceOf(NextResponse);
        const res = result as NextResponse;
        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ code });
      });

      it("gets a 403 with its code from requireAuthResponse", async () => {
        as(status);

        const result = await requireAuthResponse();

        expect(result?.status).toBe(403);
        await expect(result!.json()).resolves.toMatchObject({ code });
      });

      it("passes both helpers when the route allows restricted accounts", async () => {
        as(status);

        const user = await getAuthenticatedUserResponse({
          allowRestricted: true,
        });
        expect(user).not.toBeInstanceOf(Response);
        expect(await requireAuthResponse({ allowRestricted: true })).toBeNull();
      });
    });

    // Regression guard: nothing here may gate the onboarding funnel. A mock
    // user with no status at all is treated as unrestricted too.
    it.each([
      "active",
      "pending_verification",
      "email_verified",
      "incomplete_profile",
      undefined,
    ])("lets a %s account through both helpers", async (status) => {
      as(status);

      expect(await getAuthenticatedUserResponse()).not.toBeInstanceOf(Response);
      expect(await requireAuthResponse()).toBeNull();
    });
  });

  /**
   * The proxy no longer resolves the session for /api/* (PERF-03), so it no
   * longer bounces an email signup that hasn't verified yet. The helpers do.
   */
  describe("email verification gate", () => {
    const as = (user: Partial<typeof mockVerifiedUser>) =>
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        user: { ...mockVerifiedUser, ...user } as typeof mockVerifiedUser,
        userId: "verified-user-123",
        isAdmin: false,
      });

    it("403s an unverified email from both helpers with EMAIL_NOT_VERIFIED", async () => {
      as({ emailVerified: false, status: "pending_verification" });

      const result = await getAuthenticatedUserResponse();
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(403);
      await expect((result as NextResponse).json()).resolves.toMatchObject({
        code: "EMAIL_NOT_VERIFIED",
      });

      const required = await requireAuthResponse();
      expect(required?.status).toBe(403);
      await expect(required!.json()).resolves.toMatchObject({
        code: "EMAIL_NOT_VERIFIED",
      });
    });

    it("passes both helpers when the route allows unverified email", async () => {
      as({ emailVerified: false, status: "pending_verification" });

      expect(
        await getAuthenticatedUserResponse({ allowUnverifiedEmail: true }),
      ).not.toBeInstanceOf(Response);
      expect(
        await requireAuthResponse({ allowUnverifiedEmail: true }),
      ).toBeNull();
    });

    // A social sign-in starts at pending_verification with a provider-verified
    // email; it is mid-funnel, not unverified.
    it("lets a verified pending_verification account through", async () => {
      as({ emailVerified: true, status: "pending_verification" });

      expect(await getAuthenticatedUserResponse()).not.toBeInstanceOf(Response);
      expect(await requireAuthResponse()).toBeNull();
    });

    it("keeps the account-status code first when both apply", async () => {
      as({ emailVerified: false, status: "suspended" });

      const result = await requireAuthResponse({ allowUnverifiedEmail: true });
      await expect(result!.json()).resolves.toMatchObject({
        code: "ACCOUNT_SUSPENDED",
      });
    });
  });
});
