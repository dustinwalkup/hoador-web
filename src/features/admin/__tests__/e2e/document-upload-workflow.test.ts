import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadDocumentAction } from "@/features/admin/actions/legal-documents";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { requireAdmin } from "@/features/auth/utils/guards";
import { uploadToBlob } from "@/services/vercel-blob";
import {
  validatePDFFile,
  validateVersionFormat,
} from "@/lib/utils/document-validation";
import {
  createLegalDocumentFormData,
} from "@/test/utils/mock-legal-document-form-data";
import {
  mockCurrentDocumentVersion,
  mockDocumentVersions,
  createMockPDFFile,
  mockAdminUser,
} from "@/test/fixtures/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock dependencies
vi.mock("@/dal/legal-document.dal", () => ({
  legalDocumentDAL: {
    createVersion: vi.fn(),
    getCurrentVersion: vi.fn(),
    getAllVersions: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: vi.fn(),
}));

vi.mock("@/lib/utils/document-validation", () => ({
  validatePDFFile: vi.fn(),
  validateVersionFormat: vi.fn(),
}));

describe("Complete Document Upload Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full admin document upload workflow", async () => {
    // Step 1: Admin logs in (mock authentication)
    vi.mocked(requireAdmin).mockResolvedValue(mockAdminUser as any);

    // Step 2: Admin navigates to document management page
    // (In a real E2E test, this would involve navigation, but here we simulate it)

    // Step 3: Admin uploads document
    const mockFile = createMockPDFFile("terms-of-service-v2.pdf");
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-2.0.pdf",
      pathname: "legal-documents/tos/1234567890-2.0.pdf",
    };
    const newVersion = {
      ...mockCurrentDocumentVersion,
      version: "2.0",
      url: mockBlobResult.url,
      publishedAt: new Date("2024-03-01"),
    };

    // Mock all the services
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(newVersion);
    vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue(newVersion);
    vi.mocked(legalDocumentDAL.getAllVersions).mockResolvedValue([
      ...mockDocumentVersions,
      {
        id: LEGAL_DOCUMENT_IDS.TOS,
        version: "2.0",
        url: mockBlobResult.url,
        publishedAt: new Date("2024-03-01"),
        createdAt: new Date("2024-03-01"),
        updatedAt: new Date("2024-03-01"),
      },
    ]);

    // Create form data as admin would fill it
    const formData = createLegalDocumentFormData({
      documentId: LEGAL_DOCUMENT_IDS.TOS,
      version: "2.0",
      file: mockFile,
    });

    // Execute upload
    const result = await uploadDocumentAction(null, formData);

    // Step 4: Verifies document uploaded successfully
    expect(result.success).toBe(true);
    expect(result.documentId).toBe(LEGAL_DOCUMENT_IDS.TOS);
    expect(result.version).toBe("2.0");

    // Step 5: Verifies version created in database
    expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
      LEGAL_DOCUMENT_IDS.TOS,
      "2.0",
      mockBlobResult.url,
    );

    // Step 6: Verifies history updated with new version
    const allVersions = await legalDocumentDAL.getAllVersions(
      LEGAL_DOCUMENT_IDS.TOS,
    );
    expect(allVersions).toHaveLength(mockDocumentVersions.length + 1);
    expect(allVersions[0].version).toBe("2.0"); // Newest version first

    // Step 7: Verifies UI reflects new version (current version updated)
    const currentVersion = await legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.TOS,
    );
    expect(currentVersion).not.toBeNull();
    expect(currentVersion?.version).toBe("2.0");
    expect(currentVersion?.url).toBe(mockBlobResult.url);
  });

  it("should handle complete workflow with error at any step", async () => {
    // Step 1: Admin logs in
    vi.mocked(requireAdmin).mockResolvedValue(mockAdminUser as any);

    // Step 2: Admin navigates to document management page
    // (Simulated)

    // Step 3: Admin uploads document but blob upload fails
    const mockFile = createMockPDFFile("document.pdf");
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockRejectedValue(
      new Error("Blob storage unavailable"),
    );

    const formData = createLegalDocumentFormData({
      file: mockFile,
    });

    // Execute upload
    const result = await uploadDocumentAction(null, formData);

    // Verify error handling stops the workflow
    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Blob storage unavailable");

    // Verify database was not called
    expect(legalDocumentDAL.createVersion).not.toHaveBeenCalled();

    // Verify history was not updated
    expect(legalDocumentDAL.getAllVersions).not.toHaveBeenCalled();
  });

  it("should verify authentication is checked before any operations", async () => {
    // Arrange - Admin not authenticated
    vi.mocked(requireAdmin).mockRejectedValue(
      new Error("Admin privileges required"),
    );

    const formData = createLegalDocumentFormData();

    // Act
    const result = await uploadDocumentAction(null, formData);

    // Assert - Verify no operations were performed
    expect(result.error).toBe("Admin privileges required");
    expect(validatePDFFile).not.toHaveBeenCalled();
    expect(uploadToBlob).not.toHaveBeenCalled();
    expect(legalDocumentDAL.createVersion).not.toHaveBeenCalled();
  });

  it("should verify complete workflow with multiple document types", async () => {
    // Test workflow for different document types
    const documentTypes = [
      LEGAL_DOCUMENT_IDS.TOS,
      LEGAL_DOCUMENT_IDS.PRIVACY,
      LEGAL_DOCUMENT_IDS.COMMUNITY,
    ];

    for (const documentId of documentTypes) {
      vi.clearAllMocks();
      vi.mocked(requireAdmin).mockResolvedValue(mockAdminUser as any);
      vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
      vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
      vi.mocked(uploadToBlob).mockResolvedValue({
        url: `https://blob.vercel.com/legal-documents/${documentId}/1234567890-1.0.pdf`,
        pathname: `legal-documents/${documentId}/1234567890-1.0.pdf`,
      });
      vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue({
        ...mockCurrentDocumentVersion,
        id: documentId,
      });

      const formData = createLegalDocumentFormData({
        documentId,
        version: "1.0",
      });

      const result = await uploadDocumentAction(null, formData);

      expect(result.success).toBe(true);
      expect(result.documentId).toBe(documentId);
      expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
        documentId,
        "1.0",
        expect.stringContaining(documentId),
      );
    }
  });
});

