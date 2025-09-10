"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { showErrorToast } from "../utils/error-handling";

interface AuthErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface AuthErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error boundary component for auth flows
 * Catches JavaScript errors and displays user-friendly error messages
 */
export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Auth Error Boundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Show error toast
    showErrorToast("Something went wrong", "Please try refreshing the page.");
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            retry={this.handleRetry}
          />
        );
      }

      // Default error UI
      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <div className="w-full max-w-md">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription className="mt-2">
                We encountered an unexpected error. This might be a temporary
                issue.
              </AlertDescription>
            </Alert>

            <div className="mt-4 flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="default"
                size="sm"
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling auth errors in functional components
 */
export function useAuthErrorHandler() {
  const handleError = React.useCallback(
    (error: unknown, context: string = "Authentication") => {
      console.error(`${context} error:`, error);

      // Show appropriate error message based on error type
      let message = "Something went wrong. Please try again.";

      if (error && typeof error === "object" && "message" in error) {
        const errorMessage = (
          error as { message: string }
        ).message.toLowerCase();

        if (
          errorMessage.includes("network") ||
          errorMessage.includes("fetch")
        ) {
          message =
            "Network error. Please check your connection and try again.";
        } else if (errorMessage.includes("unauthorized")) {
          message = "You must be signed in to perform this action.";
        } else if (errorMessage.includes("verification")) {
          message = "Email verification is required to continue.";
        } else if (errorMessage.includes("already exists")) {
          message =
            "An account with this email already exists. Please try signing in instead.";
        } else if (errorMessage.includes("invalid join code")) {
          message = "Invalid join code. Please check and try again.";
        } else {
          message = (error as { message: string }).message;
        }
      }

      showErrorToast(`${context} Failed`, message);
    },
    [],
  );

  return { handleError };
}

/**
 * Default error fallback component
 */
export function DefaultAuthErrorFallback({
  // error: _error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          We encountered an unexpected error. This might be a temporary issue.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={retry} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="default"
            size="sm"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    </div>
  );
}
