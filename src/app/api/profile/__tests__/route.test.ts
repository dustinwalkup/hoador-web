import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F20 (task 9.3)
 *
 * This route had no test file. Added with `primaryCommunityId`, because the
 * mobile service-listing form now depends on it: `createServiceListingSchema`
 * requires a client-supplied `communityId`, and this is its only source.
 */

const mockGetAuthenticatedUser = vi.fn();
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUser: () => mockGetAuthenticatedUser(),
  getCurrentUserId: async () => (await mockGetAuthenticatedUser())?.id ?? null,
  getAuthenticatedUser: async () => {
    const user = await mockGetAuthenticatedUser();
    return user ? { user, userId: user.id, isAdmin: false } : null;
  },
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (h: (...a: any[]) => any) => h,
}));

const mockGetUserById = vi.fn();
const mockGetPrimaryMembership = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: { getUserById: (...a: any[]) => mockGetUserById(...a) },
  communityDAL: {
    getPrimaryMembershipForUser: (...a: any[]) =>
      mockGetPrimaryMembership(...a),
  },
}));

import { GET } from "../route";

describe("GET /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockGetUserById.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    mockGetPrimaryMembership.mockResolvedValue({
      membership: { verificationStatus: "verified" },
      community: { id: "comm-1" },
    });
  });

  it("returns the primary community id alongside the verification status", async () => {
    const res = await GET({} as never);

    await expect(res.json()).resolves.toMatchObject({
      id: "user-1",
      verificationStatus: "verified",
      primaryCommunityId: "comm-1",
    });
  });

  // A user mid-funnel has no primary membership yet. Null rather than absent, so
  // the client can tell "no community" from "old server".
  it("nulls both when there is no primary membership", async () => {
    mockGetPrimaryMembership.mockResolvedValue(null);

    const res = await GET({} as never);

    await expect(res.json()).resolves.toMatchObject({
      verificationStatus: null,
      primaryCommunityId: null,
    });
  });

  it("401s when unauthenticated", async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const res = await GET({} as never);

    expect(res.status).toBe(401);
    expect(mockGetUserById).not.toHaveBeenCalled();
  });
});
