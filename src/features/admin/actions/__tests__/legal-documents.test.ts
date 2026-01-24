import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadDocumentAction, deleteVersionAction } from "../legal-documents";
import { legalDocumentDAL } from "@/dal";
import { requireAdmin } from "@/features/auth/utils/guards";
import { uploadToBlob, deleteFromBlob } from "@/services/vercel-blob";
import {
  validatePDFFile,
  validateVersionFormat,
} from "@/lib/utils/document-validation";
import {
  createLegalDocumentFormData,
  createDeleteVersionFormData,
} from "@/test/utils/mock-legal-document-form-data";
import {
  mockCurrentDocumentVersion,
  mockDocumentVersion,
  createMockPDFFile,
  createMockLargePDFFile,
  createMockNonPDFFile,
  createMockEmptyFile,
} from "@/test/fixtures/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock dependencies
vi.mock("@/dal", () => ({
  legalDocumentDAL: {
    createVersion: vi.fn(),
    deleteVersion: vi.fn(),
    getCurrentVersion: vi.fn(),
    getVersion: vi.fn(),
  },
}));

vi.mock("@/features/auth/utils/guards", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/services/vercel-blob", () => ({
  uploadToBlob: vi.fn(),
  deleteFromBlob: vi.fn(),
}));

vi.mock("@/lib/utils/document-validation", () => ({
  validatePDFFile: vi.fn(),
  validateVersionFormat: vi.fn(),
}));

describe("uploadDocumentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Happy path", () => {
    it("should upload document successfully and create version", async () => {
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

      const formData = createLegalDocumentFormData();

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.documentId).toBe(mockCurrentDocumentVersion.id);
      expect(result.version).toBe(mockCurrentDocumentVersion.version);
      expect(requireAdmin).toHaveBeenCalled();
      expect(validatePDFFile).toHaveBeenCalled();
      expect(validateVersionFormat).toHaveBeenCalled();
      expect(uploadToBlob).toHaveBeenCalled();
      expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
        LEGAL_DOCUMENT_IDS.TOS,
        "1.0",
        mockBlobResult.url,
      );
    });
  });

  describe("Authorization errors", () => {
    it("should return error when user is not admin", async () => {
      // Arrange
      vi.mocked(requireAdmin).mockRejectedValue(
        new Error("Admin privileges required"),
      );

      const formData = createLegalDocumentFormData();

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.success).toBeUndefined();
      expect(result.error).toBe("Admin privileges required");
      expect(validatePDFFile).not.toHaveBeenCalled();
      expect(uploadToBlob).not.toHaveBeenCalled();
      expect(legalDocumentDAL.createVersion).not.toHaveBeenCalled();
    });
  });

  describe("Validation errors", () => {
    it("should return error when documentId is missing", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);

      const formData = new FormData();
      formData.append("version", "1.0");
      formData.append("file", createMockPDFFile());

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("Document ID is required");
      expect(uploadToBlob).not.toHaveBeenCalled();
    });

    it("should return error when version is missing", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);

      const formData = new FormData();
      formData.append("documentId", LEGAL_DOCUMENT_IDS.TOS);
      formData.append("file", createMockPDFFile());

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("Version is required");
      expect(uploadToBlob).not.toHaveBeenCalled();
    });

    it("should return error when file is missing", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);

      const formData = new FormData();
      formData.append("documentId", LEGAL_DOCUMENT_IDS.TOS);
      formData.append("version", "1.0");

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("File is required");
      expect(uploadToBlob).not.toHaveBeenCalled();
    });

    it("should return error when documentId is invalid", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);

      const formData = createLegalDocumentFormData({
        documentId: "invalid-doc-id",
      });

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("Invalid document ID: invalid-doc-id");
      expect(validatePDFFile).not.toHaveBeenCalled();
      expect(uploadToBlob).not.toHaveBeenCalled();
    });

    it("should return error when version format is invalid", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(validateVersionFormat).mockReturnValue({
        valid: false,
        error:
          "Version must be in semantic format (e.g., '1.0', '2.1', '1.2.3')",
      });

      const formData = createLegalDocumentFormData({
        version: "invalid-version",
      });

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe(
        "Version must be in semantic format (e.g., '1.0', '2.1', '1.2.3')",
      );
      expect(validatePDFFile).not.toHaveBeenCalled();
      expect(uploadToBlob).not.toHaveBeenCalled();
    });

    it("should return error when file type is invalid (non-PDF)", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
      vi.mocked(validatePDFFile).mockReturnValue({
        valid: false,
        error: "File must be a PDF (.pdf extension required)",
      });

      const formData = createLegalDocumentFormData({
        file: createMockNonPDFFile(),
      });

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("File must be a PDF (.pdf extension required)");
      expect(uploadToBlob).not.toHaveBeenCalled();
    });

    it("should return error when file is too large", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
      vi.mocked(validatePDFFile).mockReturnValue({
        valid: false,
        error: "File size exceeds maximum of 10.00MB",
      });

      const formData = createLegalDocumentFormData({
        file: createMockLargePDFFile(),
      });

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("File size exceeds maximum of 10.00MB");
      expect(uploadToBlob).not.toHaveBeenCalled();
    });

    it("should return error when file is empty", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
      vi.mocked(validatePDFFile).mockReturnValue({
        valid: false,
        error: "File is empty",
      });

      const formData = createLegalDocumentFormData({
        file: createMockEmptyFile(),
      });

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("File is empty");
      expect(uploadToBlob).not.toHaveBeenCalled();
    });
  });

  describe("Blob storage errors", () => {
    it("should return error when blob upload fails", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
      vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
      vi.mocked(uploadToBlob).mockRejectedValue(
        new Error("Blob storage error"),
      );

      const formData = createLegalDocumentFormData();

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("Blob storage error");
      expect(legalDocumentDAL.createVersion).not.toHaveBeenCalled();
    });

    it("should return error when blob upload returns invalid result", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(validatePDFFile).mockReturnValue({ valid: true });
      vi.mocked(validateVersionFormat).mockReturnValue({ valid: true });
      vi.mocked(uploadToBlob).mockResolvedValue({
        url: "",
        pathname: "path",
      });

      const formData = createLegalDocumentFormData();

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe(
        "Failed to upload file to storage: Invalid response",
      );
      expect(legalDocumentDAL.createVersion).not.toHaveBeenCalled();
    });
  });

  describe("Database errors", () => {
    it("should return error when database version creation fails", async () => {
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
      vi.mocked(legalDocumentDAL.createVersion).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const formData = createLegalDocumentFormData();

      // Act
      const result = await uploadDocumentAction(null, formData);

      // Assert
      expect(result.error).toBe("Database connection failed");
    });
  });

  describe("Integration: Version tracking", () => {
    it("should verify version tracking by calling DAL method", async () => {
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

      // Assert
      expect(legalDocumentDAL.createVersion).toHaveBeenCalledWith(
        LEGAL_DOCUMENT_IDS.PRIVACY,
        "2.1",
        mockBlobResult.url,
      );
    });

    it("should verify blob storage upload is called", async () => {
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

      const file = createMockPDFFile();
      const formData = createLegalDocumentFormData({ file });

      // Act
      await uploadDocumentAction(null, formData);

      // Assert
      expect(uploadToBlob).toHaveBeenCalled();
      const uploadCall = vi.mocked(uploadToBlob).mock.calls[0];
      expect(uploadCall[0]).toMatch(/^legal-documents\/tos\/\d+-1\.0\.pdf$/);
      expect(uploadCall[1]).toBeInstanceOf(Buffer);
    });
  });
});

describe("deleteVersionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Happy path", () => {
    it("should delete version successfully", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue({
        ...mockCurrentDocumentVersion,
        version: "2.0", // Different version, so deletion allowed
      });
      vi.mocked(legalDocumentDAL.getVersion).mockResolvedValue(
        mockDocumentVersion,
      );
      vi.mocked(legalDocumentDAL.deleteVersion).mockResolvedValue();
      vi.mocked(deleteFromBlob).mockResolvedValue();

      const formData = createDeleteVersionFormData({
        version: "1.0",
      });

      // Act
      const result = await deleteVersionAction(null, formData);

      // Assert
      expect(result.success).toBe(true);
      expect(requireAdmin).toHaveBeenCalled();
      expect(legalDocumentDAL.deleteVersion).toHaveBeenCalled();
    });
  });

  describe("Authorization errors", () => {
    it("should return error when user is not admin", async () => {
      // Arrange
      vi.mocked(requireAdmin).mockRejectedValue(
        new Error("Admin privileges required"),
      );

      const formData = createDeleteVersionFormData();

      // Act
      const result = await deleteVersionAction(null, formData);

      // Assert
      expect(result.success).toBeUndefined();
      expect(result.error).toBe("Admin privileges required");
      expect(legalDocumentDAL.deleteVersion).not.toHaveBeenCalled();
    });
  });

  describe("Validation errors", () => {
    it("should return error when documentId is missing", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);

      const formData = new FormData();
      formData.append("version", "1.0");

      // Act
      const result = await deleteVersionAction(null, formData);

      // Assert
      expect(result.error).toBe("Document ID is required");
      expect(legalDocumentDAL.deleteVersion).not.toHaveBeenCalled();
    });

    it("should return error when version is missing", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);

      const formData = new FormData();
      formData.append("documentId", LEGAL_DOCUMENT_IDS.TOS);

      // Act
      const result = await deleteVersionAction(null, formData);

      // Assert
      expect(result.error).toBe("Version is required");
      expect(legalDocumentDAL.deleteVersion).not.toHaveBeenCalled();
    });

    it("should return error when documentId is invalid", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);

      const formData = createDeleteVersionFormData({
        documentId: "invalid-doc-id",
      });

      // Act
      const result = await deleteVersionAction(null, formData);

      // Assert
      expect(result.error).toBe("Invalid document ID: invalid-doc-id");
      expect(legalDocumentDAL.deleteVersion).not.toHaveBeenCalled();
    });
  });

  describe("Business logic errors", () => {
    it("should return error when trying to delete current version", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue(
        mockCurrentDocumentVersion,
      );
      vi.mocked(legalDocumentDAL.getVersion).mockResolvedValue(
        mockDocumentVersion,
      );
      vi.mocked(legalDocumentDAL.deleteVersion).mockRejectedValue(
        new Error(
          "Cannot delete the current version. Upload a new version first.",
        ),
      );

      const formData = createDeleteVersionFormData({
        version: "1.0", // Same as current version
      });

      // Act
      const result = await deleteVersionAction(null, formData);

      // Assert
      expect(result.error).toBe(
        "Cannot delete the current version. Upload a new version first.",
      );
    });

    it("should return error when version not found", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue(
        mockCurrentDocumentVersion,
      );
      vi.mocked(legalDocumentDAL.getVersion).mockResolvedValue(null);
      vi.mocked(legalDocumentDAL.deleteVersion).mockRejectedValue(
        new Error("Version 1.0 not found for document tos"),
      );

      const formData = createDeleteVersionFormData({
        version: "1.0",
      });

      // Act
      const result = await deleteVersionAction(null, formData);

      // Assert
      expect(result.error).toBe("Version 1.0 not found for document tos");
    });
  });

  describe("Integration: Blob deletion", () => {
    it("should verify blob deletion is called when pathname provided", async () => {
      // Arrange
      const adminUser = { id: "admin-123", userType: "admin" };
      vi.mocked(requireAdmin).mockResolvedValue(adminUser as any);
      vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue({
        ...mockCurrentDocumentVersion,
        version: "2.0",
      });
      vi.mocked(legalDocumentDAL.getVersion).mockResolvedValue(
        mockDocumentVersion,
      );
      vi.mocked(legalDocumentDAL.deleteVersion).mockResolvedValue();
      vi.mocked(deleteFromBlob).mockResolvedValue();

      const blobPathname = "legal-documents/tos/1234567890-1.0.pdf";
      const formData = createDeleteVersionFormData({
        blobPathname,
      });

      // Act
      await deleteVersionAction(null, formData);

      // Assert
      expect(legalDocumentDAL.deleteVersion).toHaveBeenCalledWith(
        LEGAL_DOCUMENT_IDS.TOS,
        "1.0",
        blobPathname,
      );
    });
  });
});
