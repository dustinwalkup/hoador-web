import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "./auth-service";
import { ConflictError, NotFoundError, ValidationError } from "@/dal/errors";

// DAL mocks
const mockGetAllCurrentVersions = vi.fn();
const mockRecordAcceptance = vi.fn();
const mockRecordAcceptanceForSignup = vi.fn();
const mockUpdateLegalAcceptances = vi.fn();
const mockUpdateLegalAcceptancesForSignup = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateUserStatus = vi.fn();
const mockUpdateUserProfilePhoto = vi.fn();
const mockGetMembershipForUser = vi.fn();
const mockValidateJoinCodeForSignup = vi.fn();
const mockJoinCommunityForNewUser = vi.fn();
const mockSelectPrimaryCommunity = vi.fn();
const mockInitializeUserVisibility = vi.fn();
// External service mocks
const mockSignUpEmail = vi.fn();
const mockGetSession = vi.fn();
const mockCaptureNonCriticalError = vi.fn();

vi.mock("@/dal", () => ({
  legalDocumentDAL: {
    getAllCurrentVersions: (...args: unknown[]) =>
      mockGetAllCurrentVersions(...args),
    recordAcceptance: (...args: unknown[]) => mockRecordAcceptance(...args),
    recordAcceptanceForSignup: (...args: unknown[]) =>
      mockRecordAcceptanceForSignup(...args),
  },
  userDAL: {
    getUserById: (...args: unknown[]) => mockGetUserById(...args),
    updateUserStatus: (...args: unknown[]) => mockUpdateUserStatus(...args),
    updateUserProfilePhoto: (...args: unknown[]) =>
      mockUpdateUserProfilePhoto(...args),
    updateLegalAcceptances: (...args: unknown[]) =>
      mockUpdateLegalAcceptances(...args),
    updateLegalAcceptancesForSignup: (...args: unknown[]) =>
      mockUpdateLegalAcceptancesForSignup(...args),
  },
  communityDAL: {
    getMembershipForUser: (...args: unknown[]) =>
      mockGetMembershipForUser(...args),
    validateJoinCodeForSignup: (...args: unknown[]) =>
      mockValidateJoinCodeForSignup(...args),
    joinCommunityForNewUser: (...args: unknown[]) =>
      mockJoinCommunityForNewUser(...args),
    selectPrimaryCommunity: (...args: unknown[]) =>
      mockSelectPrimaryCommunity(...args),
    initializeUserVisibility: (...args: unknown[]) =>
      mockInitializeUserVisibility(...args),
  },
}));

vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      signUpEmail: (...args: unknown[]) => mockSignUpEmail(...args),
    },
  },
}));

vi.mock("@/features/auth/utils/session", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock("@/lib/api/route-helpers", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    captureNonCriticalError: (...args: unknown[]) =>
      mockCaptureNonCriticalError(...args),
  };
});

const context = { ipAddress: "127.0.0.1", userAgent: "test" };

const mockDocumentVersions = {
  tos: { version: "1.0" },
  privacy: { version: "1.0" },
};

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllCurrentVersions.mockResolvedValue(mockDocumentVersions);
    mockRecordAcceptanceForSignup.mockResolvedValue(undefined);
    mockRecordAcceptance.mockResolvedValue(undefined);
    mockUpdateLegalAcceptancesForSignup.mockResolvedValue(undefined);
    mockUpdateLegalAcceptances.mockResolvedValue(undefined);
    mockGetUserById.mockResolvedValue({
      id: "user-123",
      status: "pending_verification",
    });
    mockUpdateUserStatus.mockResolvedValue(undefined);
    mockUpdateUserProfilePhoto.mockResolvedValue(undefined);
    mockGetSession.mockResolvedValue(null);
  });

  describe("signUpWithEmail", () => {
    const signupData = {
      email: "test@example.com",
      password: "Password1",
      firstName: "Test",
      lastName: "User",
    };

    it("returns redirect with encoded email on success", async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: "user-123" },
      });

      const result = await AuthService.signUpWithEmail(
        signupData,
        true,
        context,
      );

      expect(result).toEqual({
        redirect: `/verify-email?email=${encodeURIComponent("test@example.com")}`,
        userId: "user-123",
      });
      expect(mockSignUpEmail).toHaveBeenCalledWith({
        body: {
          email: "test@example.com",
          password: "Password1",
          name: "Test User",
        },
      });
    });

    it("throws ConflictError when email already exists", async () => {
      mockSignUpEmail.mockRejectedValue(
        new Error("User with this email already exists"),
      );

      await expect(
        AuthService.signUpWithEmail(signupData, true, context),
      ).rejects.toThrow(ConflictError);
    });

    it("throws generic error when Better Auth fails", async () => {
      mockSignUpEmail.mockRejectedValue(new Error("Internal server error"));

      await expect(
        AuthService.signUpWithEmail(signupData, true, context),
      ).rejects.toThrow("Failed to create account");
    });

    it("records legal acceptances when accepted", async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: "user-123" },
      });

      await AuthService.signUpWithEmail(signupData, true, context);

      expect(mockGetAllCurrentVersions).toHaveBeenCalled();
      expect(mockRecordAcceptanceForSignup).toHaveBeenCalledTimes(2);
      expect(mockUpdateLegalAcceptancesForSignup).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          tosVersion: "1.0",
          privacyVersion: "1.0",
        }),
      );
    });

    it("skips legal acceptance recording when not accepted", async () => {
      mockSignUpEmail.mockResolvedValue({
        user: { id: "user-123" },
      });

      await AuthService.signUpWithEmail(signupData, false, context);

      expect(mockGetAllCurrentVersions).not.toHaveBeenCalled();
      expect(mockRecordAcceptanceForSignup).not.toHaveBeenCalled();
    });
  });

  describe("acceptLegalDocuments", () => {
    it("records acceptances and returns redirect to /community-select", async () => {
      const result = await AuthService.acceptLegalDocuments(
        "user-123",
        context,
      );

      expect(result).toEqual({
        redirect: "/community-select",
        isNewSignup: true,
      });
      expect(mockGetAllCurrentVersions).toHaveBeenCalled();
      expect(mockRecordAcceptance).toHaveBeenCalledTimes(2);
      expect(mockUpdateLegalAcceptances).toHaveBeenCalled();
    });

    it("updates status from pending_verification to email_verified", async () => {
      mockGetUserById.mockResolvedValue({
        id: "user-123",
        status: "pending_verification",
      });

      await AuthService.acceptLegalDocuments("user-123", context);

      expect(mockUpdateUserStatus).toHaveBeenCalledWith(
        "user-123",
        "email_verified",
      );
    });

    it("does not update status if user is not pending_verification", async () => {
      mockGetUserById.mockResolvedValue({
        id: "user-123",
        status: "email_verified",
      });

      await AuthService.acceptLegalDocuments("user-123", context);

      expect(mockUpdateUserStatus).not.toHaveBeenCalled();
    });

    it("sets profile photo from Google OAuth session", async () => {
      mockGetSession.mockResolvedValue({
        user: { image: "https://example.com/photo.jpg" },
      });

      await AuthService.acceptLegalDocuments("user-123", context);

      expect(mockUpdateUserProfilePhoto).toHaveBeenCalledWith(
        "user-123",
        "https://example.com/photo.jpg",
      );
    });
  });

  describe("joinCommunity", () => {
    beforeEach(() => {
      mockGetMembershipForUser.mockResolvedValue(null);
      mockValidateJoinCodeForSignup.mockResolvedValue({
        id: "community-456",
        name: "Test Community",
      });
      mockJoinCommunityForNewUser.mockResolvedValue({
        id: "membership-789",
      });
    });

    it("joins community and returns redirect to /onboarding", async () => {
      const result = await AuthService.joinCommunity("user-123", "ABC123");

      expect(result).toEqual({ redirect: "/onboarding" });
      expect(mockGetMembershipForUser).toHaveBeenCalledWith("user-123");
      expect(mockValidateJoinCodeForSignup).toHaveBeenCalledWith("ABC123");
      expect(mockJoinCommunityForNewUser).toHaveBeenCalledWith(
        "user-123",
        "community-456",
      );
      expect(mockUpdateUserStatus).toHaveBeenCalledWith(
        "user-123",
        "incomplete_profile",
      );
    });

    it("throws ConflictError when user already in a community", async () => {
      mockGetMembershipForUser.mockResolvedValue({
        id: "existing-membership",
      });

      await expect(
        AuthService.joinCommunity("user-123", "ABC123"),
      ).rejects.toThrow(ConflictError);
      expect(mockValidateJoinCodeForSignup).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when join code is invalid", async () => {
      mockValidateJoinCodeForSignup.mockResolvedValue(null);

      await expect(
        AuthService.joinCommunity("user-123", "INVALID"),
      ).rejects.toThrow(NotFoundError);
      expect(mockJoinCommunityForNewUser).not.toHaveBeenCalled();
    });

    it("re-throws ValidationError from DAL on join failure", async () => {
      mockJoinCommunityForNewUser.mockRejectedValue(
        new ValidationError("Community is full"),
      );

      await expect(
        AuthService.joinCommunity("user-123", "ABC123"),
      ).rejects.toThrow(ValidationError);
    });

    it("throws when status update fails", async () => {
      mockUpdateUserStatus.mockRejectedValue(new Error("Status update failed"));

      await expect(
        AuthService.joinCommunity("user-123", "ABC123"),
      ).rejects.toThrow("Failed to update account status. Please try again.");
    });
  });

  describe("selectPrimaryCommunity", () => {
    beforeEach(() => {
      mockSelectPrimaryCommunity.mockResolvedValue({
        membership: { id: "membership-1", isPrimary: true },
        community: { id: "community-456", networkId: "network-1" },
      });
      mockInitializeUserVisibility.mockResolvedValue(undefined);
    });

    it("creates the primary membership, initializes visibility, advances status, and redirects to /onboarding", async () => {
      const result = await AuthService.selectPrimaryCommunity(
        "user-123",
        "community-456",
      );

      expect(result).toEqual({ redirect: "/onboarding" });
      expect(mockSelectPrimaryCommunity).toHaveBeenCalledWith(
        "user-123",
        "community-456",
      );
      expect(mockInitializeUserVisibility).toHaveBeenCalledWith(
        "user-123",
        "network-1",
      );
      expect(mockUpdateUserStatus).toHaveBeenCalledWith(
        "user-123",
        "incomplete_profile",
      );
    });

    it("trims the communityId before delegating to the DAL", async () => {
      await AuthService.selectPrimaryCommunity("user-123", "  community-456  ");

      expect(mockSelectPrimaryCommunity).toHaveBeenCalledWith(
        "user-123",
        "community-456",
      );
    });

    it("throws ValidationError when communityId is empty", async () => {
      await expect(
        AuthService.selectPrimaryCommunity("user-123", "   "),
      ).rejects.toThrow(ValidationError);
      expect(mockSelectPrimaryCommunity).not.toHaveBeenCalled();
    });

    it("re-throws ConflictError when the user already has a primary community", async () => {
      mockSelectPrimaryCommunity.mockRejectedValue(
        new ConflictError("User already has a primary community."),
      );

      await expect(
        AuthService.selectPrimaryCommunity("user-123", "community-456"),
      ).rejects.toThrow(ConflictError);
      expect(mockInitializeUserVisibility).not.toHaveBeenCalled();
      expect(mockUpdateUserStatus).not.toHaveBeenCalled();
    });

    it("re-throws ValidationError when the community is inactive", async () => {
      mockSelectPrimaryCommunity.mockRejectedValue(
        new ValidationError("Community is not active"),
      );

      await expect(
        AuthService.selectPrimaryCommunity("user-123", "community-456"),
      ).rejects.toThrow(ValidationError);
      expect(mockInitializeUserVisibility).not.toHaveBeenCalled();
    });

    it("re-throws NotFoundError when the community does not exist", async () => {
      mockSelectPrimaryCommunity.mockRejectedValue(
        new NotFoundError("Community", "community-456"),
      );

      await expect(
        AuthService.selectPrimaryCommunity("user-123", "community-456"),
      ).rejects.toThrow(NotFoundError);
    });

    it("skips visibility initialization for a standalone community (no network)", async () => {
      mockSelectPrimaryCommunity.mockResolvedValue({
        membership: { id: "membership-1", isPrimary: true },
        community: { id: "community-456", networkId: null },
      });

      const result = await AuthService.selectPrimaryCommunity(
        "user-123",
        "community-456",
      );

      expect(result).toEqual({ redirect: "/onboarding" });
      expect(mockInitializeUserVisibility).not.toHaveBeenCalled();
      expect(mockUpdateUserStatus).toHaveBeenCalledWith(
        "user-123",
        "incomplete_profile",
      );
    });

    it("does not advance status if membership creation fails", async () => {
      mockSelectPrimaryCommunity.mockRejectedValue(
        new ConflictError("conflict"),
      );

      await expect(
        AuthService.selectPrimaryCommunity("user-123", "community-456"),
      ).rejects.toThrow();
      expect(mockUpdateUserStatus).not.toHaveBeenCalled();
    });
  });
});
