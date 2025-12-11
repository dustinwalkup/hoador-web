/**
 * File validation utilities for legal document uploads
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed MIME types for PDF files
 */
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
  "text/pdf",
  "text/x-pdf",
];

/**
 * Validate PDF file
 */
export function validatePDFFile(file: File): ValidationResult {
  // Check file exists
  if (!file) {
    return {
      valid: false,
      error: "No file provided",
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${getFileSizeMB(MAX_FILE_SIZE)}MB`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".pdf")) {
    return {
      valid: false,
      error: "File must be a PDF (.pdf extension required)",
    };
  }

  // Check MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Expected PDF, got: ${file.type}`,
    };
  }

  return { valid: true };
}

/**
 * Validate version format (semantic versioning: x.y.z or x.y)
 */
export function validateVersionFormat(version: string): ValidationResult {
  if (!version || version.trim().length === 0) {
    return {
      valid: false,
      error: "Version is required",
    };
  }

  // Allow semantic versioning: x.y.z or x.y
  // Also allow simple versions like "1", "2.0", "1.5", "2.1.0"
  const versionPattern = /^\d+(\.\d+){0,2}$/;

  if (!versionPattern.test(version.trim())) {
    return {
      valid: false,
      error: "Version must be in semantic format (e.g., '1.0', '2.1', '1.2.3')",
    };
  }

  return { valid: true };
}

/**
 * Get file size in MB (formatted to 2 decimal places)
 */
export function getFileSizeMB(file: File | number): string {
  const sizeInBytes = typeof file === "number" ? file : file.size;
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
}

/**
 * Get file size in bytes
 */
export function getFileSizeBytes(file: File): number {
  return file.size;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
