import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { ConflictError } from "@/dal/errors";

/**
 * SEC-01: onboarding used to write `status: "active"` unconditionally, so a
 * suspended user could reactivate themselves by re-posting it. It now completes
 * only from `incomplete_profile`; anything else is a 409 and writes nothing.
 */

const mockGetCurrentUserId = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: (...a: unknown[]) => mockGetCurrentUserId(...a),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  getAuthenticatedUser: vi.fn(),
}));

const mockCompleteOnboarding = vi.fn();
const mockUpdateUser = vi.fn();
const mockUpdateUserPrimaryAddress = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: {
    completeOnboarding: (...a: unknown[]) => mockCompleteOnboarding(...a),
    updateUser: (...a: unknown[]) => mockUpdateUser(...a),
    updateUserPrimaryAddress: (...a: unknown[]) =>
      mockUpdateUserPrimaryAddress(...a),
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: unknown[]) => unknown) => h,
}));

import { POST } from "../route";

const BODY = {
  firstName: "Jane",
  lastName: "Doe",
  phone: "(555) 123-4567",
  bio: "",
  street: "1 Main St",
  city: "Springfield",
  state: "IL",
  zipCode: "62701",
};

const post = (body: Record<string, unknown> = BODY) =>
  POST(
    new NextRequest("http://localhost/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/onboarding (SEC-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockUpdateUserPrimaryAddress.mockResolvedValue(undefined);
  });

  it("completes onboarding through the status-gated DAL method", async () => {
    mockCompleteOnboarding.mockResolvedValue({
      id: "user-1",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Doe",
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ firstName: "Jane", phone: "5551234567" }),
    );
    // The unconditional write is gone; the status never rides on updateUser.
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("409s a suspended (or already active) account and writes nothing else", async () => {
    mockCompleteOnboarding.mockRejectedValue(
      new ConflictError(
        "Onboarding cannot be completed from the current account status.",
      ),
    );

    const res = await post();

    expect(res.status).toBe(409);
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockUpdateUserPrimaryAddress).not.toHaveBeenCalled();
  });

  it("401s without a session", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const res = await post();

    expect(res.status).toBe(401);
    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
  });
});
