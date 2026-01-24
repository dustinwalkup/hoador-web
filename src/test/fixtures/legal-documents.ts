import type { CurrentDocumentVersion, DocumentVersion } from "@/dal/types";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

export const mockCurrentDocumentVersion: CurrentDocumentVersion = {
  id: LEGAL_DOCUMENT_IDS.TOS,
  version: "1.0",
  url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
  publishedAt: new Date("2024-01-15"),
};

export const mockDocumentVersion: DocumentVersion = {
  id: LEGAL_DOCUMENT_IDS.TOS,
  version: "1.0",
  url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
  publishedAt: new Date("2024-01-15"),
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

export const mockDocumentVersions: DocumentVersion[] = [
  {
    id: LEGAL_DOCUMENT_IDS.TOS,
    version: "2.0",
    url: "https://blob.vercel.com/legal-documents/tos/1234567891-2.0.pdf",
    // Use noon UTC to avoid timezone shifts when formatting dates
    publishedAt: new Date(Date.UTC(2024, 1, 1, 12, 0, 0)),
    createdAt: new Date(Date.UTC(2024, 1, 1, 12, 0, 0)),
    updatedAt: new Date(Date.UTC(2024, 1, 1, 12, 0, 0)),
  },
  {
    id: LEGAL_DOCUMENT_IDS.TOS,
    version: "1.0",
    url: "https://blob.vercel.com/legal-documents/tos/1234567890-1.0.pdf",
    // Use noon UTC to avoid timezone shifts when formatting dates
    publishedAt: new Date(Date.UTC(2024, 0, 15, 12, 0, 0)),
    createdAt: new Date(Date.UTC(2024, 0, 15, 12, 0, 0)),
    updatedAt: new Date(Date.UTC(2024, 0, 15, 12, 0, 0)),
  },
];

export const mockAdminUser = {
  id: "admin-123",
  userType: "admin" as const,
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "User",
};

export const mockNonAdminUser = {
  id: "user-123",
  userType: "renter" as const,
  email: "user@example.com",
  firstName: "Regular",
  lastName: "User",
};

/**
 * Creates a mock PDF File object for testing
 */
export function createMockPDFFile(
  name: string = "test-document.pdf",
  size: number = 1024,
  content: string = "PDF content",
): File {
  const file = new File([content], name, {
    type: "application/pdf",
  });
  // Override size property
  Object.defineProperty(file, "size", {
    value: size,
    writable: false,
  });
  return file;
}

/**
 * Creates a mock large PDF File (>10MB) for testing file size validation
 */
export function createMockLargePDFFile(): File {
  const largeContent = "x".repeat(11 * 1024 * 1024); // 11MB
  return createMockPDFFile(
    "large-document.pdf",
    11 * 1024 * 1024,
    largeContent,
  );
}

/**
 * Creates a mock non-PDF File for testing file type validation
 */
export function createMockNonPDFFile(): File {
  return new File(["not a pdf"], "document.txt", {
    type: "text/plain",
  });
}

/**
 * Creates a mock empty File for testing empty file validation
 */
export function createMockEmptyFile(): File {
  return createMockPDFFile("empty.pdf", 0, "");
}
