import { describe, it, expect, vi, beforeEach } from "vitest";
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

import {
  getCurrentUserId,
  getCurrentUser,
  getAuthenticatedUser,
} from "@/features/auth/utils/session";
import { requireAdmin } from "@/features/auth/utils/guards";

describe("route-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getCurrentUser to return a Promise that resolves to null
    // This prevents errors when handleApiError tries to set user context
    vi.mocked(getCurrentUser).mockResolvedValue(null);
  });

  describe("handleApiError", () => {
    it("should handle UnauthorizedError with 401 status", () => {
      const error = new UnauthorizedError("Not authorized");
      const response = handleApiError(error);

      expect(response.status).toBe(401);
      expect(response).toBeInstanceOf(NextResponse);
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
      vi.mocked(getCurrentUserId).mockResolvedValue("user-123");

      const result = await requireAuthResponse();

      expect(result).toBeNull();
    });

    it("should return 401 response when user is not authenticated", async () => {
      vi.mocked(getCurrentUserId).mockResolvedValue(null);

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
});
