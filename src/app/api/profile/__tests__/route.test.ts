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
const mockUpdateUser = vi.fn();
const mockUpdateUserPrimaryAddress = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: {
    getUserById: (...a: any[]) => mockGetUserById(...a),
    updateUser: (...a: any[]) => mockUpdateUser(...a),
    updateUserPrimaryAddress: (...a: any[]) =>
      mockUpdateUserPrimaryAddress(...a),
  },
  communityDAL: {
    getPrimaryMembershipForUser: (...a: any[]) =>
      mockGetPrimaryMembership(...a),
  },
}));

vi.mock("@/features/activity/lib/track-activity", () => ({
  trackActivity: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";

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

/**
 * SEC-02: this route used to write `email` straight to the user row, leaving
 * `emailVerified` true on an address nobody had verified. better-auth trusts
 * Google/Apple and links a new OAuth sign-in onto an account whose local email
 * is verified, so claiming a victim's email here pre-hijacked their account.
 */
describe("PATCH /api/profile", () => {
  const patch = (body: Record<string, unknown>) =>
    PATCH(
      new NextRequest("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockGetUserById.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
    });
    mockUpdateUser.mockResolvedValue(undefined);
    mockUpdateUserPrimaryAddress.mockResolvedValue(undefined);
  });

  it("refuses to change the login email and writes nothing", async () => {
    const res = await patch({
      email: "attacker-controlled@evil.example",
      firstName: "New",
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "EMAIL_CHANGE_NOT_SUPPORTED",
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockUpdateUserPrimaryAddress).not.toHaveBeenCalled();
  });

  // Re-sending the address the account already has (a form echoing it back) is
  // not a change, so it must not fail the rest of the update.
  it("accepts the current email in another case, and never writes it", async () => {
    const res = await patch({
      email: "  Owner@Example.COM ",
      firstName: "New",
    });

    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { firstName: "New" });
  });

  it("does not look the user up when no email is sent", async () => {
    const res = await patch({ firstName: "New" });

    expect(res.status).toBe(200);
    expect(mockGetUserById).not.toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { firstName: "New" });
  });

  // Mass-assignment regression: only schema fields reach the DAL.
  it("drops fields outside the profile schema", async () => {
    const res = await patch({
      status: "active",
      userType: "admin",
      emailVerified: true,
      firstName: "New",
    });

    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { firstName: "New" });
  });

  // SEC-11: a foreign avatar URL would let DELETE /api/profile/upload's
  // "current image" ownership fallback delete another user's blob.
  it.each([
    [
      "another user's prefix",
      "https://store.public.blob.vercel-storage.com/profiles/user-2/1.jpg",
    ],
    [
      "a foreign host with the caller's path",
      "https://evil.example/profiles/user-1/1.jpg",
    ],
    [
      "a legacy flat path",
      "https://store.public.blob.vercel-storage.com/profiles/1.jpg",
    ],
  ])("silently drops a profileImageUrl on %s", async (_label, url) => {
    const res = await patch({ firstName: "New", profileImageUrl: url });

    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { firstName: "New" });
  });

  it("keeps a profileImageUrl under the caller's own prefix", async () => {
    const url =
      "https://store.public.blob.vercel-storage.com/profiles/user-1/1.jpg";
    const res = await patch({ profileImageUrl: url });

    expect(res.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
      profileImageUrl: url,
    });
  });
});

/**
 * SEC-01: the mobile app reads `GET /api/profile` to learn the account is
 * suspended and route to its "account isn't active" screen. A 403 would strand
 * it on a retry loop, so GET opts out of the gate. PATCH does not.
 */
describe("/api/profile for a suspended account (SEC-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({
      id: "user-1",
      status: "suspended",
    });
    mockGetUserById.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      status: "suspended",
    });
    mockGetPrimaryMembership.mockResolvedValue(null);
  });

  it("still answers GET with the account's status", async () => {
    const res = await GET({} as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "suspended" });
  });

  it("refuses PATCH with ACCOUNT_SUSPENDED and writes nothing", async () => {
    const res = await PATCH(
      new NextRequest("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: "New" }),
      }),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
