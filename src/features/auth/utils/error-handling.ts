import { toast } from "sonner";

/**
 * Error handling utilities for auth flows
 * Provides consistent error messages and toast notifications
 */

export interface AuthError {
  success: false;
  error: string;
  code?: string;
}

export interface AuthSuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export type AuthResult<T = unknown> = AuthError | AuthSuccess<T>;

/**
 * Handle server action errors with appropriate toast notifications
 */
export function handleAuthError(
  error: unknown,
  context: string = "Authentication",
): AuthError {
  console.error(`${context} error:`, error);

  let errorMessage = "Something went wrong. Please try again.";
  let errorCode = "UNKNOWN_ERROR";

  // Handle specific error types
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: string }).message.toLowerCase();

    if (message.includes("already exists") || message.includes("duplicate")) {
      errorMessage =
        "An account with this email already exists. Please try signing in instead.";
      errorCode = "EMAIL_EXISTS";
    } else if (message.includes("invalid join code")) {
      errorMessage = "Invalid join code. Please check and try again.";
      errorCode = "INVALID_JOIN_CODE";
    } else if (message.includes("password")) {
      errorMessage = "Password does not meet requirements. Please try again.";
      errorCode = "INVALID_PASSWORD";
    } else if (message.includes("phone")) {
      errorMessage = "Please enter a valid phone number.";
      errorCode = "INVALID_PHONE";
    } else if (message.includes("email")) {
      errorMessage = "Please enter a valid email address.";
      errorCode = "INVALID_EMAIL";
    } else if (message.includes("unauthorized")) {
      errorMessage = "You must be signed in to perform this action.";
      errorCode = "UNAUTHORIZED";
    } else if (message.includes("verification")) {
      errorMessage = "Email verification is required to continue.";
      errorCode = "VERIFICATION_REQUIRED";
    } else if (message.includes("network") || message.includes("fetch")) {
      errorMessage =
        "Network error. Please check your connection and try again.";
      errorCode = "NETWORK_ERROR";
    } else {
      // Use the original error message if it's user-friendly
      errorMessage = (error as { message: string }).message;
    }
  }

  return {
    success: false,
    error: errorMessage,
    code: errorCode,
  };
}

/**
 * Show success toast notification
 */
export function showSuccessToast(message: string, description?: string) {
  toast.success(message, {
    description,
    duration: 5000,
  });
}

/**
 * Show error toast notification
 */
export function showErrorToast(message: string, description?: string) {
  toast.error(message, {
    description,
    duration: 7000,
  });
}

/**
 * Show info toast notification
 */
export function showInfoToast(message: string, description?: string) {
  toast.info(message, {
    description,
    duration: 5000,
  });
}

/**
 * Show warning toast notification
 */
export function showWarningToast(message: string, description?: string) {
  toast.warning(message, {
    description,
    duration: 5000,
  });
}

/**
 * Handle form validation errors
 */
export function handleValidationError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    // Zod validation error
    return (error as { issues: { message: string }[] }).issues
      .map((issue) => issue.message)
      .join(", ");
  }

  if (error && typeof error === "object" && "message" in error) {
    return (error as { message: string }).message;
  }

  return "Please check your input and try again.";
}

/**
 * Handle server action result with toast notifications
 */
export function handleServerActionResult<T>(
  result: { success: boolean; error?: string; message?: string; data?: T },
  successMessage?: string,
  context: string = "Action",
): AuthResult<T> {
  if (result.success) {
    if (successMessage) {
      showSuccessToast(successMessage);
    } else if (result.message) {
      showSuccessToast(result.message);
    }

    return {
      success: true,
      data: result.data,
      message: result.message,
    };
  } else {
    const errorMessage =
      result.error || "Something went wrong. Please try again.";
    showErrorToast(`${context} Failed`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Common error messages for different scenarios
 */
export const AUTH_ERROR_MESSAGES = {
  EMAIL_EXISTS:
    "An account with this email already exists. Please try signing in instead.",
  INVALID_JOIN_CODE: "Invalid join code. Please check and try again.",
  INVALID_PASSWORD: "Password does not meet requirements. Please try again.",
  INVALID_PHONE: "Please enter a valid phone number.",
  INVALID_EMAIL: "Please enter a valid email address.",
  UNAUTHORIZED: "You must be signed in to perform this action.",
  VERIFICATION_REQUIRED: "Email verification is required to continue.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  GENERIC_ERROR: "Something went wrong. Please try again.",
} as const;

/**
 * Success messages for different scenarios
 */
export const AUTH_SUCCESS_MESSAGES = {
  JOIN_CODE_VALID: "Join code is valid! You can proceed with signup.",
  ACCOUNT_CREATED:
    "Account created successfully! Please check your email for verification.",
  GOOGLE_ACCOUNT_CREATED:
    "Account created successfully! Please complete your profile.",
  EMAIL_VERIFIED: "Email verified successfully! Please complete your profile.",
  ONBOARDING_COMPLETED: "Profile completed successfully! Welcome to Hoador.",
  VERIFICATION_EMAIL_SENT:
    "Verification email sent. Please check your inbox and spam folder.",
} as const;
