import { describe, it, expect, vi, beforeEach } from "vitest";
import { acceptLegalDocumentsAction } from "../accept-legal-documents";
import { mockLegalDocuments } from "@/test/fixtures/auth";

// Mock dependencies
vi.mock("@/dal", () => ({
  userDAL: {
    updateLegalAcceptances: vi.fn(),
    getUserById: vi.fn(),
    updateUserStatus: vi.fn(),
    updateUserProfilePhoto: vi.fn(),
  },
  legalDocumentDAL: {
    getAllCurrentVersions: vi.fn(),
    recordAcceptance: vi.fn(),
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

import { legalDocumentDAL, userDAL } from "@/dal";
import { getSession } from "../../utils/session";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { mockVerifiedUser } from "@/test/fixtures/auth";

describe("acceptLegalDocumentsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockHeaders = new Headers();
    mockHeaders.set("x-forwarded-for", "192.168.1.1");
    mockHeaders.set("user-agent", "test-agent");
    vi.mocked(headers).mockResolvedValue(mockHeaders as any);
  });

  it("should accept legal documents successfully", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("tosAccepted", "true");
    formData.append("privacyAccepted", "true");

    const mockSession = {
      user: {
        id: mockVerifiedUser.id,
        email: mockVerifiedUser.email,
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

    // Act
    try {
      await acceptLegalDocumentsAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert
    expect(legalDocumentDAL.getAllCurrentVersions).toHaveBeenCalled();
    expect(legalDocumentDAL.recordAcceptance).toHaveBeenCalledTimes(2); // TOS and Privacy
    expect(userDAL.updateLegalAcceptances).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/join-code");
  });

  it("should return error when TOS is not accepted", async () => {
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

  it("should return error when Privacy Policy is not accepted", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("tosAccepted", "true");
    formData.append("privacyAccepted", "false");

    // Act
    const result = await acceptLegalDocumentsAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain("You must accept the Terms of Service");
    expect(legalDocumentDAL.getAllCurrentVersions).not.toHaveBeenCalled();
  });

  it("should return error when user is not logged in", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("tosAccepted", "true");
    formData.append("privacyAccepted", "true");

    vi.mocked(getSession).mockResolvedValue(null);

    // Act
    const result = await acceptLegalDocumentsAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "You must be logged in to accept legal documents.",
    );
    expect(legalDocumentDAL.getAllCurrentVersions).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("tosAccepted", "true");
    formData.append("privacyAccepted", "true");

    const mockSession = {
      user: {
        id: mockVerifiedUser.id,
        email: mockVerifiedUser.email,
      },
    };

    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    vi.mocked(legalDocumentDAL.getAllCurrentVersions).mockRejectedValue(
      new Error("Database error"),
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Act
    const result = await acceptLegalDocumentsAction(null, formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should update user profile photo if available from session", async () => {
    // Arrange
    const formData = new FormData();
    formData.append("tosAccepted", "true");
    formData.append("privacyAccepted", "true");

    const mockSession = {
      user: {
        id: mockVerifiedUser.id,
        email: mockVerifiedUser.email,
        image: "https://example.com/profile.jpg",
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
    vi.mocked(userDAL.updateUserProfilePhoto).mockResolvedValue(undefined);

    // Act
    try {
      await acceptLegalDocumentsAction(null, formData);
    } catch {
      // redirect() throws
    }

    // Assert
    expect(userDAL.updateUserProfilePhoto).toHaveBeenCalledWith(
      mockVerifiedUser.id,
      "https://example.com/profile.jpg",
    );
  });
});
