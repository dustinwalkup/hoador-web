import { describe, it, expect, vi, beforeEach } from "vitest";
import { acceptLegalDocumentsAction } from "../../actions/accept-legal-documents";
import { signupAction } from "../../actions/signup";
import { legalDocumentDAL, userDAL } from "@/dal";
import { mockLegalDocuments, mockSignupData } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/dal", () => ({
  userDAL: {
    updateLegalAcceptances: vi.fn(),
    updateLegalAcceptancesForSignup: vi.fn(),
    getUserById: vi.fn(),
    updateUserStatus: vi.fn(),
    updateUserProfilePhoto: vi.fn(),
  },
  legalDocumentDAL: {
    getAllCurrentVersions: vi.fn(),
    recordAcceptance: vi.fn(),
    recordAcceptanceForSignup: vi.fn(),
  },
}));

vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

vi.mock("../../utils/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: vi.fn(),
}));

import { getSession } from "../../utils/session";
import { tryCatch } from "@walkup/walkup-utils";
import { headers } from "next/headers";
import { mockVerifiedUser } from "@/test/fixtures/auth";

describe("Legal Documents Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockHeaders = new Headers();
    mockHeaders.set("x-forwarded-for", "192.168.1.1");
    mockHeaders.set("user-agent", "test-agent");
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
  });

  it("should complete legal documents flow: Signup → Acceptance → Recorded", async () => {
    // Arrange - Step 1: Signup with legal acceptance
    const signupFormData = new FormData();
    signupFormData.append("email", mockSignupData.email);
    signupFormData.append("password", mockSignupData.password);
    signupFormData.append("firstName", mockSignupData.firstName);
    signupFormData.append("lastName", mockSignupData.lastName);
    signupFormData.append("legalAccepted", "true");

    const mockAuthResult = {
      user: {
        id: "user-123",
        email: mockSignupData.email,
      },
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockAuthResult,
      error: null,
    } as any);

    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue(
      mockLegalDocuments,
    );
    vi.mocked(legalDocumentDAL.recordAcceptanceForSignup).mockResolvedValue(
      undefined,
    );
    vi.mocked(userDAL.updateLegalAcceptancesForSignup).mockResolvedValue(
      undefined,
    );

    // Act - Step 1: Signup
    try {
      await signupAction(null, signupFormData);
    } catch {
      // redirect() throws
    }

    // Assert - Step 1: Verify legal documents were recorded during signup
    expect(legalDocumentDAL.recordAcceptanceForSignup).toHaveBeenCalledTimes(2);
    expect(userDAL.updateLegalAcceptancesForSignup).toHaveBeenCalled();

    // Arrange - Step 2: Accept legal documents (for OAuth users)
    vi.clearAllMocks();
    const acceptFormData = new FormData();
    acceptFormData.append("tosAccepted", "true");
    acceptFormData.append("privacyAccepted", "true");

    const mockSession = {
      user: {
        id: "user-123",
        email: mockSignupData.email,
      },
    };

    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue(
      mockLegalDocuments,
    );
    vi.mocked(legalDocumentDAL.recordAcceptance).mockResolvedValue(undefined);
    vi.mocked(userDAL.updateLegalAcceptances).mockResolvedValue(undefined);
    vi.mocked(userDAL.getUserById).mockResolvedValue(mockVerifiedUser);
    vi.mocked(userDAL.updateUserStatus).mockResolvedValue(undefined);

    // Act - Step 2: Accept legal documents
    try {
      await acceptLegalDocumentsAction(null, acceptFormData);
    } catch {
      // redirect() throws
    }

    // Assert - Step 2: Verify legal documents were recorded
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledTimes(2);
    expect(userDAL.updateLegalAcceptances).toHaveBeenCalled();
  });

  it("should validate that required documents must be accepted", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("tosAccepted", "false");
    formData.append("privacyAccepted", "true");

    // Act
    const result = await acceptLegalDocumentsAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("You must accept the Terms of Service");
    expect(legalDocumentDAL.getAllCurrentVersions).not.toHaveBeenCalled();
  });

  it("should support both acceptance formats (legalAccepted and tosAccepted/privacyAccepted)", async () => {
    // Arrange - Test signup with legalAccepted format
    const signupFormData1 = new FormData();
    signupFormData1.append("email", mockSignupData.email);
    signupFormData1.append("password", mockSignupData.password);
    signupFormData1.append("firstName", mockSignupData.firstName);
    signupFormData1.append("lastName", mockSignupData.lastName);
    signupFormData1.append("legalAccepted", "true");

    const mockAuthResult = {
      user: {
        id: "user-123",
        email: mockSignupData.email,
      },
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockAuthResult,
      error: null,
    } as any);
    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue(
      mockLegalDocuments,
    );
    vi.mocked(legalDocumentDAL.recordAcceptanceForSignup).mockResolvedValue(
      undefined,
    );
    vi.mocked(userDAL.updateLegalAcceptancesForSignup).mockResolvedValue(
      undefined,
    );

    // Act
    try {
      await signupAction(null, signupFormData1);
    } catch {
      // redirect() throws
    }

    // Assert
    expect(legalDocumentDAL.recordAcceptanceForSignup).toHaveBeenCalledTimes(2);

    // Arrange - Test signup with legacy format (tosAccepted/privacyAccepted)
    vi.clearAllMocks();
    const signupFormData2 = new FormData();
    signupFormData2.append("email", "another@example.com");
    signupFormData2.append("password", mockSignupData.password);
    signupFormData2.append("firstName", mockSignupData.firstName);
    signupFormData2.append("lastName", mockSignupData.lastName);
    signupFormData2.append("tosAccepted", "true");
    signupFormData2.append("privacyAccepted", "true");

    const mockAuthResult2 = {
      user: {
        id: "user-456",
        email: "another@example.com",
      },
    };

    vi.mocked(tryCatch).mockResolvedValue({
      data: mockAuthResult2,
      error: null,
    } as any);
    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockResolvedValue(
      mockLegalDocuments,
    );
    vi.mocked(legalDocumentDAL.recordAcceptanceForSignup).mockResolvedValue(
      undefined,
    );
    vi.mocked(userDAL.updateLegalAcceptancesForSignup).mockResolvedValue(
      undefined,
    );

    // Act
    try {
      await signupAction(null, signupFormData2);
    } catch {
      // redirect() throws
    }

    // Assert - Both formats should work
    expect(legalDocumentDAL.recordAcceptanceForSignup).toHaveBeenCalledTimes(2);
  });
});
