import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUserId,
  requireAuth,
  getCurrentUser,
} from "@/features/auth/utils/session";
import { requireAdmin } from "@/features/auth/utils/guards";
import { getClientIP, getUserAgent } from "@/lib/utils/request-context";
import {
  DALError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
} from "@/dal/errors";

/**
 * Handle API errors consistently
 * Maps DAL errors to appropriate HTTP status codes and user-friendly messages
 */
export function handleApiError(
  error: unknown,
): NextResponse<{ error: string; details?: unknown }> {
  console.error("API error:", error);

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
