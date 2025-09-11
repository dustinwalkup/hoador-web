"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";

/**
 * Error types for different scenarios
 */
export type ErrorType =
  | "validation"
  | "network"
  | "authentication"
  | "authorization"
  | "not_found"
  | "server"
  | "unknown";

/**
 * Error severity levels
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Error information interface
 */
export interface ErrorInfo {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  field?: string;
  code?: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Loading state interface
 */
export interface LoadingState {
  isLoading: boolean;
  loadingMessage?: string;
  progress?: number;
}

/**
 * Hook for comprehensive error handling and loading states
 */
export function useErrorHandling() {
  // Error state
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [currentError, setCurrentError] = useState<ErrorInfo | null>(null);

  // Loading state
  const [loadingStates, setLoadingStates] = useState<
    Record<string, LoadingState>
  >({});

  /**
   * Create error info from various error sources
   */
  const createErrorInfo = useCallback(
    (
      error: unknown,
      type: ErrorType = "unknown",
      field?: string,
    ): ErrorInfo => {
      let message = "An unexpected error occurred";
      let details: string | undefined;
      let severity: ErrorSeverity = "medium";
      let retryable = false;

      if (error instanceof Error) {
        message = error.message;
        details = error.stack;
      } else if (typeof error === "string") {
        message = error;
      } else if (error && typeof error === "object" && "message" in error) {
        message = String(error.message);
      }

      // Determine error type and severity based on message content
      if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("timeout")
      ) {
        type = "network";
        severity = "medium";
        retryable = true;
      } else if (
        message.includes("unauthorized") ||
        message.includes("authentication")
      ) {
        type = "authentication";
        severity = "high";
      } else if (
        message.includes("forbidden") ||
        message.includes("permission")
      ) {
        type = "authorization";
        severity = "high";
      } else if (message.includes("not found") || message.includes("404")) {
        type = "not_found";
        severity = "medium";
      } else if (
        message.includes("validation") ||
        message.includes("invalid")
      ) {
        type = "validation";
        severity = "low";
      } else if (message.includes("server") || message.includes("500")) {
        type = "server";
        severity = "high";
        retryable = true;
      }

      return {
        type,
        severity,
        message,
        details,
        field,
        timestamp: new Date(),
        retryable,
      };
    },
    [],
  );

  /**
   * Add error to state
   */
  const addError = useCallback(
    (error: unknown, type?: ErrorType, field?: string) => {
      const errorInfo = createErrorInfo(error, type, field);

      setErrors((prev) => [...prev, errorInfo]);
      setCurrentError(errorInfo);

      // Show toast notification
      if (errorInfo.severity === "low") {
        toast.info(errorInfo.message);
      } else if (
        errorInfo.severity === "medium" ||
        errorInfo.severity === "high"
      ) {
        toast.error(errorInfo.message);
      } else {
        toast.error(errorInfo.message);
      }

      return errorInfo;
    },
    [createErrorInfo],
  );

  /**
   * Clear specific error
   */
  const clearError = useCallback((errorId: string) => {
    setErrors((prev) =>
      prev.filter((error) => error.timestamp.toISOString() !== errorId),
    );
    setCurrentError(null);
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setErrors([]);
    setCurrentError(null);
  }, []);

  /**
   * Clear errors for specific field
   */
  const clearFieldErrors = useCallback(
    (field: string) => {
      setErrors((prev) => prev.filter((error) => error.field !== field));
      if (currentError?.field === field) {
        setCurrentError(null);
      }
    },
    [currentError],
  );

  /**
   * Set loading state for specific operation
   */
  const setLoading = useCallback(
    (
      operation: string,
      isLoading: boolean,
      message?: string,
      progress?: number,
    ) => {
      setLoadingStates((prev) => ({
        ...prev,
        [operation]: {
          isLoading,
          loadingMessage: message,
          progress,
        },
      }));
    },
    [],
  );

  /**
   * Clear loading state for specific operation
   */
  const clearLoading = useCallback((operation: string) => {
    setLoadingStates((prev) => {
      const newStates = { ...prev };
      delete newStates[operation];
      return newStates;
    });
  }, []);

  /**
   * Check if any operation is loading
   */
  const isAnyLoading = useMemo(() => {
    return Object.values(loadingStates).some((state) => state.isLoading);
  }, [loadingStates]);

  /**
   * Get loading state for specific operation
   */
  const getLoadingState = useCallback(
    (operation: string) => {
      return loadingStates[operation] || { isLoading: false };
    },
    [loadingStates],
  );

  /**
   * Handle async operation with error handling and loading states
   */
  const handleAsyncOperation = useCallback(
    async <T>(
      operation: string,
      asyncFn: () => Promise<T>,
      options: {
        loadingMessage?: string;
        onSuccess?: (result: T) => void;
        onError?: (error: ErrorInfo) => void;
        retryable?: boolean;
      } = {},
    ): Promise<T | null> => {
      const { loadingMessage, onSuccess, onError } = options;

      try {
        setLoading(operation, true, loadingMessage);
        clearFieldErrors(operation);

        const result = await asyncFn();

        setLoading(operation, false);
        onSuccess?.(result);

        return result;
      } catch (error) {
        const errorInfo = addError(error, "unknown", operation);
        setLoading(operation, false);
        onError?.(errorInfo);

        return null;
      }
    },
    [setLoading, clearFieldErrors, addError],
  );

  /**
   * Retry failed operation
   */
  const retryOperation = useCallback(
    async <T>(
      operation: string,
      asyncFn: () => Promise<T>,
      options: {
        loadingMessage?: string;
        onSuccess?: (result: T) => void;
        onError?: (error: ErrorInfo) => void;
      } = {},
    ): Promise<T | null> => {
      // Clear previous errors for this operation
      clearFieldErrors(operation);

      return handleAsyncOperation(operation, asyncFn, options);
    },
    [clearFieldErrors, handleAsyncOperation],
  );

  /**
   * Get error title based on type
   */
  const getErrorTitle = useCallback((error: ErrorInfo) => {
    switch (error.type) {
      case "validation":
        return "Validation Error";
      case "network":
        return "Connection Error";
      case "authentication":
        return "Authentication Error";
      case "authorization":
        return "Access Denied";
      case "not_found":
        return "Not Found";
      case "server":
        return "Server Error";
      default:
        return "Error";
    }
  }, []);

  /**
   * Get error variant for toast
   */
  const getErrorVariant = useCallback((severity: ErrorSeverity) => {
    switch (severity) {
      case "low":
        return "default" as const;
      case "medium":
        return "destructive" as const;
      case "high":
        return "destructive" as const;
      case "critical":
        return "destructive" as const;
      default:
        return "destructive" as const;
    }
  }, []);

  /**
   * Get user-friendly error message
   */
  const getUserFriendlyMessage = useCallback((error: ErrorInfo) => {
    switch (error.type) {
      case "validation":
        return error.message;
      case "network":
        return "Please check your internet connection and try again.";
      case "authentication":
        return "Please sign in to continue.";
      case "authorization":
        return "You don't have permission to perform this action.";
      case "not_found":
        return "The requested resource was not found.";
      case "server":
        return "Something went wrong on our end. Please try again later.";
      default:
        return error.message || "An unexpected error occurred.";
    }
  }, []);

  /**
   * Check if error is retryable
   */
  const isErrorRetryable = useCallback((error: ErrorInfo) => {
    return error.retryable;
  }, []);

  /**
   * Get errors by field
   */
  const getFieldErrors = useCallback(
    (field: string) => {
      return errors.filter((error) => error.field === field);
    },
    [errors],
  );

  /**
   * Get errors by type
   */
  const getErrorsByType = useCallback(
    (type: ErrorType) => {
      return errors.filter((error) => error.type === type);
    },
    [errors],
  );

  /**
   * Get critical errors
   */
  const getCriticalErrors = useMemo(() => {
    return errors.filter((error) => error.severity === "critical");
  }, [errors]);

  return {
    // Error state
    errors,
    currentError,

    // Error actions
    addError,
    clearError,
    clearAllErrors,
    clearFieldErrors,

    // Loading state
    loadingStates,
    isAnyLoading,
    setLoading,
    clearLoading,
    getLoadingState,

    // Async operation handling
    handleAsyncOperation,
    retryOperation,

    // Error utilities
    getErrorTitle,
    getErrorVariant,
    getUserFriendlyMessage,
    isErrorRetryable,
    getFieldErrors,
    getErrorsByType,
    getCriticalErrors,

    // Helper functions
    createErrorInfo,
  };
}

/**
 * Hook for form-specific error handling
 */
export function useFormErrorHandling() {
  const errorHandling = useErrorHandling();

  /**
   * Handle form validation errors
   */
  const handleValidationErrors = useCallback(
    (validationErrors: Record<string, string>) => {
      Object.entries(validationErrors).forEach(([field, message]) => {
        errorHandling.addError(message, "validation", field);
      });
    },
    [errorHandling],
  );

  /**
   * Handle server response errors
   */
  const handleServerError = useCallback(
    (error: unknown, field?: string) => {
      return errorHandling.addError(error, "server", field);
    },
    [errorHandling],
  );

  /**
   * Clear form errors
   */
  const clearFormErrors = useCallback(() => {
    errorHandling.clearAllErrors();
  }, [errorHandling]);

  return {
    ...errorHandling,
    handleValidationErrors,
    handleServerError,
    clearFormErrors,
  };
}
