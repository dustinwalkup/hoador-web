import { describe, it, expect, vi, beforeEach } from "vitest";
import { joinCommunityAction } from "@/features/auth/actions/join-community";
import { mockVerifiedUser, mockJoinCode } from "@/test/fixtures/auth";
import {
  mockCommunity,
  mockUserCommunityInfo,
} from "@/test/fixtures/community";

// Mock dependencies
vi.mock("@/dal", () => ({
  communityDAL: {
    getMembershipForUser: vi.fn(),
    validateJoinCodeForSignup: vi.fn(),
    joinCommunityForNewUser: vi.fn(),
  },
  userDAL: {
    updateUserStatus: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { communityDAL, userDAL } from "@/dal";
import { requireAuth } from "@/features/auth/utils/session";
import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";

describe("Complete Community Join Workflow (E2E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full community join workflow", async () => {
    // Step 1: User enters join code (form data)
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Step 2: Code validated via validateJoinCodeForSignup
    // Step 3: Membership granted via joinCommunityForNewUser
    // Step 4: User gains access (verify membership exists)

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth - Step 1: Authentication
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser - Step 2: Check existing membership (none)
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup - Step 3: Validate join code
      .mockResolvedValueOnce({ data: mockUserCommunityInfo, error: null }) // joinCommunityForNewUser - Step 4: Grant membership
      .mockResolvedValueOnce({ data: undefined, error: null }); // updateUserStatus - Step 5: Update user status

    // Act - Execute complete workflow
    try {
      await joinCommunityAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert - Verify all steps executed in sequence
    expect(tryCatch).toHaveBeenCalledTimes(5);

    // Step 1: Verify authentication
    expect(requireAuth).toHaveBeenCalled();

    // Step 2: Verify existing membership check
    expect(communityDAL.getMembershipForUser).toHaveBeenCalledWith(
      mockVerifiedUser.id,
    );

    // Step 3: Verify join code validation
    expect(communityDAL.validateJoinCodeForSignup).toHaveBeenCalledWith(
      mockJoinCode.trim(),
    );

    // Step 4: Verify membership granted
    expect(communityDAL.joinCommunityForNewUser).toHaveBeenCalledWith(
      mockVerifiedUser.id,
      mockCommunity.id,
    );

    // Step 5: Verify user status updated
    expect(userDAL.updateUserStatus).toHaveBeenCalled();

    // Step 6: Verify redirect to onboarding (user gains access)
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("should handle error at step 1: Authentication required", async () => {
    // Step 1: User enters join code
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Step 2: Authentication fails
    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: new Error("Authentication required"),
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert - Workflow stops at authentication
    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication required. Please log in again.");
    expect(communityDAL.getMembershipForUser).not.toHaveBeenCalled();
    expect(communityDAL.validateJoinCodeForSignup).not.toHaveBeenCalled();
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle error at step 2: User already in community", async () => {
    // Step 1: User enters join code
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Step 2: User already has membership
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: mockUserCommunityInfo, error: null }); // getMembershipForUser (existing)

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert - Workflow stops at membership check
    expect(result.success).toBe(false);
    expect(result.error).toContain("already a member of a community");
    expect(communityDAL.getMembershipForUser).toHaveBeenCalledWith(
      mockVerifiedUser.id,
    );
    expect(communityDAL.validateJoinCodeForSignup).not.toHaveBeenCalled();
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should handle error at step 3: Invalid join code", async () => {
    // Step 1: User enters join code
    const formData = new FormData();
    formData.append("joinCode", "INVALID123");

    // Step 2: Join code validation fails
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser
      .mockResolvedValueOnce({ data: null, error: null }); // validateJoinCodeForSignup returns null (invalid)

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert - Workflow stops at validation
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid join code");
    expect(communityDAL.validateJoinCodeForSignup).toHaveBeenCalledWith(
      "INVALID123".trim(),
    );
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should handle error at step 4: Join community fails", async () => {
    // Step 1: User enters join code
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Step 2: Join community operation fails
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup
      .mockResolvedValueOnce({
        data: null,
        error: new Error("Failed to join community"),
      }); // joinCommunityForNewUser fails

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert - Workflow stops at join operation
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unable to join community. Please try again.");
    expect(communityDAL.joinCommunityForNewUser).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle error at step 1: Invalid join code format", async () => {
    // Step 1: User enters invalid join code format
    const formData = new FormData();
    formData.append("joinCode", ""); // Empty join code

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert - Workflow stops at format validation
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid join code format.");
    expect(tryCatch).not.toHaveBeenCalled();
    expect(communityDAL.validateJoinCodeForSignup).not.toHaveBeenCalled();
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
