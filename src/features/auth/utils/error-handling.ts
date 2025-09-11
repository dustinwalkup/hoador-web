/**
 * V2 Auth Error Handling Utilities
 *
 * Centralized error handling for the auth system.
 * Provides consistent error classification, formatting, and user-friendly messages.
 */

import type { ZodError } from "zod";
import type { ErrorState } from "../types/auth.types";

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Error types for classification
 */
export enum ErrorType {
  VALIDATION = "validation",
  NETWORK = "network",
  AUTH = "auth",
  SERVER = "server",
  RATE_LIMIT = "rate_limit",
  UNKNOWN = "unknown",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "low", // Minor validation errors
  MEDIUM = "medium", // Form submission errors
  HIGH = "high", // Authentication failures
  CRITICAL = "critical", // System errors
}

// ============================================================================
// ERROR CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classify error by type and severity
 */
export function classifyError(error: unknown): {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  retryable: boolean;
} {
  // Handle Zod validation errors
  if (isZodError(error)) {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      message: formatZodError(error),
      retryable: true,
    };
  }

  // Handle network errors
  if (isNetworkError(error)) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      message: "Network error. Please check your connection and try again.",
      retryable: true,
    };
  }

  // Handle auth errors
  if (isAuthError(error)) {
    return {
      type: ErrorType.AUTH,
      severity: ErrorSeverity.HIGH,
      message: formatAuthError(error),
      retryable: false,
    };
  }

  // Handle server errors
  if (isServerError(error)) {
    return {
      type: ErrorType.SERVER,
      severity: ErrorSeverity.HIGH,
      message: formatServerError(error),
      retryable: true,
    };
  }

  // Handle rate limit errors
  if (isRateLimitError(error)) {
    return {
      type: ErrorType.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      message: "Too many requests. Please wait a moment and try again.",
      retryable: true,
    };
  }

  // Handle unknown errors
  return {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.CRITICAL,
    message: "An unexpected error occurred. Please try again.",
    retryable: true,
  };
}

// ============================================================================
// ERROR TYPE DETECTION
// ============================================================================

/**
 * Check if error is a Zod validation error
 */
function isZodError(error: unknown): error is ZodError {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as ZodError).issues)
  );
}

/**
 * Check if error is a network error
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("connection") ||
      error.name === "NetworkError" ||
      error.name === "TypeError"
    );
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("unauthorized") ||
      message.includes("invalid credentials") ||
      message.includes("authentication failed") ||
      message.includes("email not verified") ||
      message.includes("account not found") ||
      message.includes("invalid password") ||
      message.includes("invalid email")
    );
  }
  return false;
}

/**
 * Check if error is a server error
 */
function isServerError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("internal server error") ||
      message.includes("database error") ||
      message.includes("service unavailable") ||
      message.includes("timeout") ||
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503")
    );
  }
  return false;
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429")
    );
  }
  return false;
}

// ============================================================================
// ERROR FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format Zod validation error
 */
function formatZodError(error: ZodError): string {
  const firstIssue = error.issues[0];
  return firstIssue?.message || "Validation failed";
}

/**
 * Format authentication error
 */
function formatAuthError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("invalid credentials")) {
      return "Invalid email or password. Please try again.";
    }

    if (message.includes("email not verified")) {
      return "Please verify your email address before signing in.";
    }

    if (message.includes("account not found")) {
      return "No account found with this email address.";
    }

    if (message.includes("invalid password")) {
      return "Incorrect password. Please try again.";
    }

    if (message.includes("invalid email")) {
      return "Please enter a valid email address.";
    }

    return "Authentication failed. Please try again.";
  }

  return "Authentication error occurred.";
}

/**
 * Format server error
 */
function formatServerError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("database")) {
      return "Database error. Please try again in a moment.";
    }

    if (message.includes("timeout")) {
      return "Request timed out. Please try again.";
    }

    if (message.includes("service unavailable")) {
      return "Service temporarily unavailable. Please try again later.";
    }

    return "Server error occurred. Please try again.";
  }

  return "Server error occurred.";
}

// ============================================================================
// USER-FRIENDLY ERROR MESSAGES
// ============================================================================

/**
 * Get user-friendly error message for signup errors
 */
export function getSignupErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Email already exists
    if (message.includes("already exists") || message.includes("duplicate")) {
      return "An account with this email already exists. Please try signing in instead.";
    }

    // Invalid join code
    if (message.includes("invalid join code")) {
      return "Invalid join code. Please check with your community administrator.";
    }

    // Password requirements
    if (message.includes("password")) {
      return "Password must be at least 8 characters with uppercase, lowercase, and number.";
    }

    // Phone number issues
    if (message.includes("phone")) {
      return "Please enter a valid phone number.";
    }

    // Address issues
    if (message.includes("address") || message.includes("zip")) {
      return "Please check your address information and try again.";
    }

    // Terms not accepted
    if (message.includes("terms")) {
      return "You must accept the terms of service to create an account.";
    }
  }

  const classified = classifyError(error);
  return classified.message;
}

/**
 * Get user-friendly error message for signin errors
 */
export function getSigninErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("invalid credentials")) {
      return "Invalid email or password. Please try again.";
    }

    if (message.includes("email not verified")) {
      return "Please verify your email address first. Check your inbox for a verification link.";
    }

    if (message.includes("account suspended")) {
      return "Your account has been suspended. Please contact support.";
    }

    if (message.includes("account not found")) {
      return "No account found with this email. Would you like to create one?";
    }
  }

  const classified = classifyError(error);
  return classified.message;
}

/**
 * Get user-friendly error message for email verification errors
 */
export function getVerificationErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("expired")) {
      return "Verification link has expired. Please request a new one.";
    }

    if (message.includes("invalid token")) {
      return "Invalid verification link. Please request a new one.";
    }

    if (message.includes("already verified")) {
      return "Your email is already verified. You can now sign in.";
    }
  }

  return "Email verification failed. Please try again.";
}

// ============================================================================
// ERROR STATE CREATION
// ============================================================================

/**
 * Create error state from any error
 */
export function createErrorState(error: unknown, field?: string): ErrorState {
  const classified = classifyError(error);

  return {
    message: classified.message,
    severity: classified.severity,
    field,
    retryable: classified.retryable,
    code: classified.type,
  };
}

/**
 * Create validation error state from Zod error
 */
export function createValidationErrorState(
  error: ZodError,
): Record<string, ErrorState> {
  const errors: Record<string, ErrorState> = {};

  error.issues.forEach((issue) => {
    const field = issue.path.join(".");
    errors[field] = {
      message: issue.message,
      severity: ErrorSeverity.LOW,
      field,
      retryable: true,
      code: issue.code,
    };
  });

  return errors;
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Log error with context
 */
export function logError(
  error: unknown,
  context: string,
  userId?: string,
  metadata?: Record<string, unknown>,
): void {
  const classified = classifyError(error);

  const logData = {
    timestamp: new Date().toISOString(),
    context,
    userId,
    errorType: classified.type,
    severity: classified.severity,
    message: classified.message,
    retryable: classified.retryable,
    metadata,
    stack: error instanceof Error ? error.stack : undefined,
  };

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("Auth Error:", logData);
  }

  // In production, you would send this to your logging service
  // Example: sendToLoggingService(logData);
}

// ============================================================================
// ERROR RECOVERY
// ============================================================================

/**
 * Determine if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.retryable;
}

/**
 * Get retry delay based on error type
 */
export function getRetryDelay(error: unknown, attempt: number): number {
  const classified = classifyError(error);

  switch (classified.type) {
    case ErrorType.RATE_LIMIT:
      return Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff up to 30s
    case ErrorType.NETWORK:
      return Math.min(500 * Math.pow(2, attempt), 10000); // Exponential backoff up to 10s
    case ErrorType.SERVER:
      return Math.min(1000 * attempt, 5000); // Linear backoff up to 5s
    default:
      return 1000; // 1 second default
  }
}

/**
 * Check if should retry based on error and attempt count
 */
export function shouldRetry(error: unknown, attempt: number): boolean {
  if (attempt >= 3) return false; // Max 3 retries

  const classified = classifyError(error);

  // Don't retry validation or auth errors
  if (
    classified.type === ErrorType.VALIDATION ||
    classified.type === ErrorType.AUTH
  ) {
    return false;
  }

  return classified.retryable;
}
