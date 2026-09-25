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

/**
 * SEC-11: same rule as PATCH /api/profile — only the caller's own avatar blob
 * is written. An empty or foreign value is dropped, so the column keeps
 * whatever POST /api/profile/upload already set.
 */
describe("POST /api/onboarding — profileImageUrl (SEC-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue("user-1");
    mockUpdateUserPrimaryAddress.mockResolvedValue(undefined);
    mockCompleteOnboarding.mockResolvedValue({
      id: "user-1",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Doe",
    });
  });

  const written = () => mockCompleteOnboarding.mock.calls[0][1];

  it("keeps an avatar under the caller's own prefix", async () => {
    const url =
      "https://store.public.blob.vercel-storage.com/profiles/user-1/1.jpg";
    await post({ ...BODY, profileImageUrl: url });

    expect(written().profileImageUrl).toBe(url);
  });

  it.each([
    "https://store.public.blob.vercel-storage.com/profiles/user-2/1.jpg",
    "https://evil.example/profiles/user-1/1.jpg",
  ])("drops a foreign avatar %s", async (url) => {
    const res = await post({ ...BODY, profileImageUrl: url });

    expect(res.status).toBe(200);
    expect(written()).not.toHaveProperty("profileImageUrl");
  });

  it("doesn't overwrite the uploaded avatar when none is sent", async () => {
    await post(BODY);

    expect(written()).not.toHaveProperty("profileImageUrl");
  });
});
