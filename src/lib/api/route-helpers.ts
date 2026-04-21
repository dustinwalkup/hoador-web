import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { SESSION_EXPIRED_MESSAGE } from "@/features/auth/constants";
import {
  getCurrentUserId,
  requireAuth,
  getCurrentUser,
  getAuthenticatedUser,
} from "@/features/auth/utils/session";
import { requireAdmin } from "@/features/auth/utils/guards";
import { getClientIP, getUserAgent } from "@/lib/utils/request-context";
import { getRequestContext } from "@/lib/logger";
import {
  DALError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ServiceBookingPaymentFailedError,
} from "@/dal/errors";
import { setSentryUser } from "@/lib/sentry/user-context";

/**
 * Error class for unauthorized access at the API layer
 * This is NOT a DAL error - it's used for auth failures in API routes
 */
export class UnauthorizedError extends Error {
  public code = "UNAUTHORIZED";
  public statusCode = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Handle API errors consistently
 * Maps DAL errors to appropriate HTTP status codes and user-friendly messages
 */
export function handleApiError(
  error: unknown,
): NextResponse<{ error: string; details?: unknown }> {
  console.error("API error:", error);

  // Set user context for Sentry from the already-resolved ALS slot.
  // withRequestLogging populates this via getCurrentUser on first access, so
  // error paths don't kick off a second auth chain just to tag the error.
  const ctxUser = getRequestContext()?.user;
  if (ctxUser) {
    setSentryUser(ctxUser as Parameters<typeof setSentryUser>[0]);
  }

  // Only capture unexpected errors (500+) in production
  const shouldCaptureError =
    process.env.NODE_ENV === "production" &&
    !(error instanceof UnauthorizedError) &&
    !(error instanceof NotFoundError) &&
    !(error instanceof ValidationError) &&
    !(error instanceof ConflictError);

  if (shouldCaptureError) {
    const ctx = getRequestContext();
    Sentry.captureException(error, {
      tags: {
        error_type: error instanceof DALError ? "dal_error" : "api_error",
        ...(ctx?.requestId && { requestId: ctx.requestId }),
        ...(ctx?.userId != null && { userId: String(ctx.userId) }),
        ...(ctx?.route && { route: ctx.route }),
        ...(process.env.NODE_ENV && {
          environment: process.env.NODE_ENV,
        }),
      },
    });
  }

  // Handle DAL errors with specific status codes
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message || "Unauthorized" },
      { status: 401 },
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message || "Resource not found" },
      { status: 404 },
    );
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message || "Validation failed",
        details: error.field ? { field: error.field } : undefined,
      },
      { status: 400 },
    );
  }

  if (error instanceof ConflictError) {
    return NextResponse.json(
      { error: error.message || "Conflict" },
      { status: 409 },
    );
  }

  if (error instanceof ServiceBookingPaymentFailedError) {
    return NextResponse.json(
      {
        error: error.message || "Payment failed",
        paymentFailed: true,
      },
      { status: 400 },
    );
  }

  if (error instanceof DALError) {
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: error.statusCode || 500 },
    );
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (
      error.message.includes("Unauthorized") ||
      error.message.includes("Authentication")
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 },
    );
  }

  // Fallback for unknown errors
  return NextResponse.json(
    { error: "An unexpected error occurred" },
    { status: 500 },
  );
}

/**
 * Capture a non-critical error in Sentry without failing the request.
 * Use for fire-and-forget side effects (notifications, emails, PDF generation, etc.)
 * where the primary operation succeeded but a secondary action failed.
 */
export function captureNonCriticalError(
  error: unknown,
  context: { route: string; action: string },
): void {
  console.error(`[${context.route}] ${context.action}:`, error);
  const reqCtx = getRequestContext();
  Sentry.captureException(error, {
    level: "warning",
    tags: {
      error_type: "non_critical",
      route: context.route,
      action: context.action,
      ...(reqCtx?.requestId && { requestId: reqCtx.requestId }),
      ...(reqCtx?.userId != null && { userId: String(reqCtx.userId) }),
      ...(process.env.NODE_ENV && {
        environment: process.env.NODE_ENV,
      }),
    },
  });
}

/**
 * Require authentication in API routes
 * Returns NextResponse with 401 if not authenticated, otherwise returns null
 */
export async function requireAuthResponse(): Promise<NextResponse<{
  error: string;
}> | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  return null;
}

/**
 * Require admin privileges in API routes
 * Returns NextResponse with 403 if not admin, otherwise returns null
 */
export async function requireAdminResponse(): Promise<NextResponse<{
  error: string;
}> | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin")) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }
    // If it's an auth error, return 401
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
}

/**
 * Parse FormData or JSON from request
 * Supports both Content-Type: application/json and multipart/form-data
 */
export async function parseFormData(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";

  // Handle JSON requests
  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      throw new ValidationError("Invalid JSON in request body");
    }
  }

  // Handle FormData requests
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const result: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      // Handle multiple values for the same key (e.g., checkboxes)
      if (result[key]) {
        if (Array.isArray(result[key])) {
          (result[key] as unknown[]).push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // Try to parse as JSON as fallback
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Unsupported content type");
  }
}

/**
 * Extract client IP address from request
 * Re-exports from request-context for convenience
 */
export { getClientIP };

/**
 * Extract user agent from request
 * Re-exports from request-context for convenience
 */
export { getUserAgent };

/**
 * Get authenticated user ID for API routes
 * Returns null if not authenticated (use requireAuthResponse for error handling)
 */
export { getCurrentUserId };

/**
 * Get authenticated user for API routes
 * Returns null if not authenticated
 */
export { getCurrentUser };

/**
 * Require authentication and return user
 * Throws error if not authenticated (use requireAuthResponse for API routes)
 */
export { requireAuth };

/**
 * Require admin privileges
 * Throws error if not admin (use requireAdminResponse for API routes)
 */
export { requireAdmin };

/**
 * Get authenticated user with admin check for API routes
 * Returns NextResponse with 401 if not authenticated, otherwise returns user data
 */
export async function getAuthenticatedUserResponse(): Promise<
  | NextResponse<{ error: string }>
  | {
      user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
      userId: string;
      isAdmin: boolean;
    }
> {
  const result = await getAuthenticatedUser();
  if (!result) {
    return NextResponse.json(
      { error: SESSION_EXPIRED_MESSAGE },
      { status: 401 },
    );
  }
  return result;
}
