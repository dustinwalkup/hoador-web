import { describe, it, expect, vi, beforeEach } from "vitest";
import { signupAction } from "../../actions/signup";
import { userDAL, legalDocumentDAL } from "@/dal";
import { mockSignupData, mockLegalDocuments } from "@/test/fixtures/auth";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock dependencies
vi.mock("@/dal", () => ({
  userDAL: {
    updateLegalAcceptancesForSignup: vi.fn(),
  },
  legalDocumentDAL: {
    getAllCurrentVersions: vi.fn(),
    recordAcceptanceForSignup: vi.fn(),
  },
}));

vi.mock("@/services/better-auth", () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
    },
  },
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

import { tryCatch } from "@walkup/walkup-utils";
import { headers } from "next/headers";

describe("Signup Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockHeaders = new Headers();
    mockHeaders.set("x-forwarded-for", "192.168.1.1");
    mockHeaders.set("user-agent", "test-agent");
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
  });

  it("should complete full signup flow: Form → Action → DAL → Database", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", mockSignupData.email);
    formData.append("password", mockSignupData.password);
    formData.append("firstName", mockSignupData.firstName);
    formData.append("lastName", mockSignupData.lastName);
    formData.append("legalAccepted", "true");

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
      await signupAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert - Verify complete flow execution
    expect(tryCatch).toHaveBeenCalled(); // Better Auth signup
    expect(legalDocumentDAL.getAllCurrentVersions).toHaveBeenCalled();
    expect(legalDocumentDAL.recordAcceptanceForSignup).toHaveBeenCalledTimes(2); // TOS and Privacy
    expect(userDAL.updateLegalAcceptancesForSignup).toHaveBeenCalled();
  });

  it("should propagate validation errors from action to form", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", "invalid-email");
    formData.append("password", mockSignupData.password);
    formData.append("firstName", mockSignupData.firstName);
    formData.append("lastName", mockSignupData.lastName);
    formData.append("legalAccepted", "true");

    // Act
    const result = await signupAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(tryCatch).not.toHaveBeenCalled();
  });

  it("should record legal document acceptances in database", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", mockSignupData.email);
    formData.append("password", mockSignupData.password);
    formData.append("firstName", mockSignupData.firstName);
    formData.append("lastName", mockSignupData.lastName);
    formData.append("legalAccepted", "true");

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
      await signupAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert - Verify legal documents are recorded
    expect(legalDocumentDAL.recordAcceptanceForSignup).toHaveBeenCalledWith(
      "user-123",
      LEGAL_DOCUMENT_IDS.TOS,
      mockLegalDocuments[LEGAL_DOCUMENT_IDS.TOS].version,
      "192.168.1.1",
      "test-agent",
      "email",
    );
    expect(legalDocumentDAL.recordAcceptanceForSignup).toHaveBeenCalledWith(
      "user-123",
      LEGAL_DOCUMENT_IDS.PRIVACY,
      mockLegalDocuments[LEGAL_DOCUMENT_IDS.PRIVACY].version,
      "192.168.1.1",
      "test-agent",
      "email",
    );
    expect(userDAL.updateLegalAcceptancesForSignup).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({
        tosVersion: mockLegalDocuments[LEGAL_DOCUMENT_IDS.TOS].version,
        privacyVersion: mockLegalDocuments[LEGAL_DOCUMENT_IDS.PRIVACY].version,
      }),
    );
  });

  it("should handle error propagation from DAL to action", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("email", mockSignupData.email);
    formData.append("password", mockSignupData.password);
    formData.append("firstName", mockSignupData.firstName);
    formData.append("lastName", mockSignupData.lastName);
    formData.append("legalAccepted", "true");

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

    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockRejectedValue(
      new Error("Database error"),
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    try {
      await signupAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert - Error is logged but user account creation succeeds
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
