import { describe, it, expect, vi, beforeEach } from "vitest";
import { joinCommunityAction } from "../join-community";
import { mockVerifiedUser } from "@/test/fixtures/auth";
import { mockJoinCode } from "@/test/fixtures/auth";
import { ValidationError, UnauthorizedError } from "@/dal/errors";

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

vi.mock("../../utils/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { redirect } from "next/navigation";
import { tryCatch } from "@walkup/walkup-utils";

describe("joinCommunityAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should join community with valid join code", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    const mockCommunity = {
      id: "community-123",
      name: "Test Community",
    };

    const mockCommunityInfo = {
      community: mockCommunity,
      user: {
        id: mockVerifiedUser.id,
        fullName: `${mockVerifiedUser.firstName} ${mockVerifiedUser.lastName}`,
        initials: "TU",
        email: mockVerifiedUser.email,
      },
    };

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup
      .mockResolvedValueOnce({ data: mockCommunityInfo, error: null }) // joinCommunityForNewUser
      .mockResolvedValueOnce({ data: undefined, error: null }); // updateUserStatus

    // Act
    try {
      await joinCommunityAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("should return error when join code format is invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", ""); // Empty join code

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid join code format.");
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should return error when user is not authenticated", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    vi.mocked(tryCatch).mockResolvedValueOnce({
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
    consoleErrorSpy.mockRestore();
  });

  it("should return error when user is already in a community", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: { id: "membership-123" }, error: null }); // getMembershipForUser

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("already a member of a community");
  });

  it("should return error when join code is invalid", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", "INVALID123");

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser
      .mockResolvedValueOnce({ data: null, error: null }); // validateJoinCodeForSignup returns null (invalid code)

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid join code");
  });

  it("should handle case-insensitive join code matching", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode.toLowerCase());

    const mockCommunity = {
      id: "community-123",
      name: "Test Community",
    };

    const mockCommunityInfo = {
      community: mockCommunity,
      user: {
        id: mockVerifiedUser.id,
        fullName: `${mockVerifiedUser.firstName} ${mockVerifiedUser.lastName}`,
        initials: "TU",
        email: mockVerifiedUser.email,
      },
    };

    // Use sequential mocks for each tryCatch call in order
    // Join code should be trimmed, case-insensitive matching handled by DAL
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup
      .mockResolvedValueOnce({ data: mockCommunityInfo, error: null }) // joinCommunityForNewUser
      .mockResolvedValueOnce({ data: undefined, error: null }); // updateUserStatus

    // Act
    try {
      await joinCommunityAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("should return error when ValidationError occurs", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    const mockCommunity = {
      id: "community-123",
      name: "Test Community",
    };

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup
      .mockResolvedValueOnce({
        data: null,
        error: new ValidationError("Invalid join code"),
      }); // joinCommunityForNewUser

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid join code");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should return error when UnauthorizedError occurs", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("joinCode", mockJoinCode);

    const mockCommunity = {
      id: "community-123",
      name: "Test Community",
    };

    // Use sequential mocks for each tryCatch call in order
    vi.mocked(tryCatch)
      .mockResolvedValueOnce({ data: mockVerifiedUser, error: null }) // requireAuth
      .mockResolvedValueOnce({ data: null, error: null }) // getMembershipForUser
      .mockResolvedValueOnce({ data: mockCommunity, error: null }) // validateJoinCodeForSignup
      .mockResolvedValueOnce({
        data: null,
        error: new UnauthorizedError("Unauthorized"),
      }); // joinCommunityForNewUser

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await joinCommunityAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication required. Please log in again.");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
