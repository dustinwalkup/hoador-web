import { describe, it, expect, vi, beforeEach } from "vitest";
import { joinCommunityAction } from "@/features/auth/actions/join-community";
import { mockVerifiedUser, mockJoinCode } from "@/test/fixtures/auth";
import {
  mockCommunity,
  mockUserCommunityInfo,
} from "@/test/fixtures/community";
import { ValidationError } from "@/dal/errors";

// Mock dependencies
vi.mock("@/dal", () => ({
  communityDAL: {
    getCurrentUserMembership: vi.fn(),
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

import { communityDAL } from "@/dal";
import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";

describe("Join Code Validation Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full flow: User enters join code → code validated → membership granted", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getCurrentUserMembership (no existing membership)
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup
      .mockResolvedValueOnce({ data: mockUserCommunityInfo, error: null }) // joinCommunityForNewUser
      .mockResolvedValueOnce({ data: undefined, error: null }); // updateUserStatus

    // Act
    try {
      await joinCommunityAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert
    expect(tryCatch).toHaveBeenCalledTimes(5);
    expect(redirect).toHaveBeenCalledWith("/onboarding");

    // Verify DAL methods were called with correct parameters
    expect(communityDAL.getCurrentUserMembership).toHaveBeenCalled();
    expect(communityDAL.validateJoinCodeForSignup).toHaveBeenCalledWith(
      mockJoinCode.trim(),
    );
    expect(communityDAL.joinCommunityForNewUser).toHaveBeenCalledWith(
      mockVerifiedUser.id,
      mockCommunity.id,
    );
  });

  it("should handle error path: Invalid join code", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getCurrentUserMembership
      .mockResolvedValueOnce({ data: null, error: null }); // validateJoinCodeForSignup returns null (invalid code)

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid join code");
    expect(communityDAL.validateJoinCodeForSignup).toHaveBeenCalledWith(
      mockJoinCode.trim(),
    );
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();
  });

  it("should handle error path: User already in community", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: mockUserCommunityInfo, error: null }); // getCurrentUserMembership (existing membership)

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("already a member of a community");
    expect(communityDAL.getCurrentUserMembership).toHaveBeenCalled();
    expect(communityDAL.validateJoinCodeForSignup).not.toHaveBeenCalled();
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();
  });

  it("should handle error path: Authentication required", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    vi.mocked(tryCatch).mockResolvedValue({
      data: null,
      error: new Error("Authentication required"),
    } as any);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication required. Please log in again.");
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(communityDAL.getCurrentUserMembership).not.toHaveBeenCalled();
    expect(communityDAL.validateJoinCodeForSignup).not.toHaveBeenCalled();
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle error path: Join code validation error", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getCurrentUserMembership
      .mockResolvedValueOnce({
        data: null,
        error: new ValidationError("Join code validation failed"),
      }); // validateJoinCodeForSignup error

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Unable to validate join code. Please try again.",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(communityDAL.validateJoinCodeForSignup).toHaveBeenCalled();
    expect(communityDAL.joinCommunityForNewUser).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle error path: Join community error", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getCurrentUserMembership
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup
      .mockResolvedValueOnce({
        data: null,
        error: new Error("Failed to join community"),
      }); // joinCommunityForNewUser error

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unable to join community. Please try again.");
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(communityDAL.joinCommunityForNewUser).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
