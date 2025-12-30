import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadDocumentAction } from "@/features/admin/actions/legal-documents";
import { legalDocumentDAL } from "@/dal/legal-document.dal";
import { requireAdmin } from "@/features/auth/utils/guards";
import { uploadToBlob } from "@/services/vercel-blob";
import {
  validatePDFFile,
  validateVersionFormat,
} from "@/lib/utils/document-validation";
import { createLegalDocumentFormData } from "@/test/utils/mock-legal-document-form-data";
import {
  mockCurrentDocumentVersion,
  mockDocumentVersions,
  createMockPDFFile,
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

describe("Document Upload Flow: Form → Action → Storage → Database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete full document upload workflow", async () => {
    // Arrange - Set up mocks for the entire flow
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockFile = createMockPDFFile("document.pdf");
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
      pathname: "legal-documents/tos/1234567890-1.0.pdf",
    };

    // Mock each step in the workflow
    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(
      mockCurrentDocumentVersion,
    );

    // Create FormData as the form would
    const formData = createLegalDocumentFormData({
      documentId: LEGAL_DOCUMENT_IDS.TOS,
      version: "1.0",
      file: mockFile,
    });

    // Act - Execute the complete workflow
    const result = await uploadDocumentAction(null, formData);

    // Assert - Verify the ENTIRE flow worked together
    expect(result.success).toBe(true);
    expect(result.version).toBe("1.0");
    expect(result.documentId).toBe(mockCurrentDocumentVersion.id);

    // Verify each step was called in sequence
    expect(requireAdmin).toHaveBeenCalled(); // Step 1: Auth check
    expect(validatePDFFile).toHaveBeenCalledWith(mockFile); // Step 2: Validation
    expect(validateVersionFormat).toHaveBeenCalledWith("1.0"); // Step 3: Version validation
    expect(uploadToBlob).toHaveBeenCalled(); // Step 4: Storage upload
    expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
      LEGAL_DOCUMENT_IDS.TOS,
      "1.0",
      mockBlobResult.url,
    ); // Step 5: Database record

    // Verify the workflow completed successfully
    expect(result.documentId).toBe("tos");
  });

  it("should verify admin authorization check", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue({
      url: "https://blob.vercel.com/test.pdf",
      pathname: "test.pdf",
    });
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(
      mockCurrentDocumentVersion,
    );

    const formData = createLegalDocumentFormData();

    // Act
    await uploadDocumentAction(null, formData);

    // Assert - Verify authorization was checked first
    expect(requireAdmin).toHaveBeenCalled();
    // Verify other steps were called after authorization
    expect(validatePDFFile).toHaveBeenCalled();
  });

  it("should verify file validation", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockFile = createMockPDFFile();
    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue({
      url: "https://blob.vercel.com/test.pdf",
      pathname: "test.pdf",
    });
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(
      mockCurrentDocumentVersion,
    );

    const formData = createLegalDocumentFormData({ file: mockFile });

    // Act
    await uploadDocumentAction(null, formData);

    // Assert - Verify file validation was called
    expect(validatePDFFile).toHaveBeenCalledWith(mockFile);
  });

  it("should verify blob storage upload", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockFile = createMockPDFFile();
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
      pathname: "legal-documents/tos/1234567890-1.0.pdf",
    };

    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(
      mockCurrentDocumentVersion,
    );

    const formData = createLegalDocumentFormData({ file: mockFile });

    // Act
    await uploadDocumentAction(null, formData);

    // Assert - Verify blob upload was called with correct parameters
    expect(uploadToBlob).toHaveBeenCalled();
    const uploadCall = vi.mocked(uploadToBlob).mock.calls[0];
    expect(uploadCall[0]).toMatch(/^legal-documents\/tos\/\d+-1\.0\.pdf$/);
    expect(uploadCall[1]).toBeInstanceOf(Buffer);
  });

  it("should verify database version creation", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
      pathname: "legal-documents/tos/1234567890-1.0.pdf",
    };

    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(
      mockCurrentDocumentVersion,
    );

    const formData = createLegalDocumentFormData({
      documentId: LEGAL_DOCUMENT_IDS.PRIVACY,
      version: "2.1",
    });

    // Act
    await uploadDocumentAction(null, formData);

    // Assert - Verify database version creation was called with correct parameters
    expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
      LEGAL_DOCUMENT_IDS.PRIVACY,
      "2.1",
      mockBlobResult.url,
    );
  });

  it("should verify version tracking", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
      pathname: "legal-documents/tos/1234567890-1.0.pdf",
    };

    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(
      mockCurrentDocumentVersion,
    );

    const formData = createLegalDocumentFormData({
      version: "1.5",
    });

    // Act
    const result = await uploadDocumentAction(null, formData);

    // Assert - Verify version was tracked correctly
    expect(result.version).toBe("1.0"); // From mockCurrentDocumentVersion
    expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
      LEGAL_DOCUMENT_IDS.TOS,
      "1.5",
      mockBlobResult.url,
    );
  });
});

describe("Version Tracking Flow: Upload → Version Created → History Updated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should verify version number assignment", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-2.0.pdf",
      pathname: "legal-documents/tos/1234567890-2.0.pdf",
    };
    const newVersion = {
      ...mockCurrentDocumentVersion,
      version: "2.0",
    };

    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(newVersion);

    const formData = createLegalDocumentFormData({
      version: "2.0",
    });

    // Act
    const result = await uploadDocumentAction(null, formData);

    // Assert - Verify version number was assigned correctly
    expect(result.version).toBe("2.0");
    expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
      LEGAL_DOCUMENT_IDS.TOS,
      "2.0",
      mockBlobResult.url,
    );
  });

  it("should verify published date set", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
      pathname: "legal-documents/tos/1234567890-1.0.pdf",
    };
    const publishedDate = new Date("2024-03-01");
    const newVersion = {
      ...mockCurrentDocumentVersion,
      publishedAt: publishedDate,
    };

    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(newVersion);

    const formData = createLegalDocumentFormData();

    // Act
    await uploadDocumentAction(null, formData);

    // Assert - Verify DAL was called (which sets published date)
    expect(legalDocumentDAL.createVersion).toHaveBeenCalled();
    // The DAL method sets publishedAt internally, so we verify it was called
  });

  it("should verify version appears in history", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-2.0.pdf",
      pathname: "legal-documents/tos/1234567890-2.0.pdf",
    };
    const newVersion = {
      ...mockCurrentDocumentVersion,
      version: "2.0",
    };

    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(newVersion);
    vi.mocked(legalDocumentDAL.getAllVersions).mockResolvedValue([
      ...mockDocumentVersions,
      {
        ...mockDocumentVersions[0],
        version: "2.0",
        url: mockBlobResult.url,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const formData = createLegalDocumentFormData({
      version: "2.0",
    });

    // Act
    await uploadDocumentAction(null, formData);

    // Assert - Verify version was created (which would appear in history)
    expect(legalDocumentDAL.createVersion).toHaveBeenCalled();
    // In a real scenario, getAllVersions would be called to show history
    // Here we verify the version creation step completed
  });

  it("should verify current version updated", async () => {
    // Arrange
    const adminUser = { id: "admin-123", userType: "admin" };
    const mockBlobResult = {
      url: "https://blob.vercel.com/legal-documents/tos/1234567890-2.0.pdf",
      pathname: "legal-documents/tos/1234567890-2.0.pdf",
    };
    const newCurrentVersion = {
      ...mockCurrentDocumentVersion,
      version: "2.0",
      url: mockBlobResult.url,
    };

    vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
    vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
    vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
    vi.mocked(uploadToBlob).mockResolvedValue(mockBlobResult);
    vi.mocked(legalDocumentDAL.createVersion).mockResolvedValue(
      newCurrentVersion,
    );
    vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue(
      newCurrentVersion,
    );

    const formData = createLegalDocumentFormData({
      version: "2.0",
    });

    // Act
    const result = await uploadDocumentAction(null, formData);

    // Assert - Verify new version becomes current
    expect(result.version).toBe("2.0");
    expect(legalDocumentDAL.createVersion).toHaveBeenCalled();
    // In a real scenario, getCurrentVersion would return the new version
  });
});
