import { vi } from "vitest";
import type { Mock } from "vitest";
import { UnauthorizedError } from "@/dal/errors";
import { mockSession, mockAdminSession as mockAdminSessionData } from "../fixtures/auth";

/**
 * Mocks getCurrentUserId to return a user ID
 */
export function mockGetCurrentUserId(userId: string = "user-123"): Mock {
  return vi.fn().mockResolvedValue(userId);
}

/**
 * Mocks getCurrentUserId to throw UnauthorizedError
 */
export function mockGetCurrentUserIdUnauthorized(): Mock {
  return vi.fn().mockRejectedValue(new UnauthorizedError("Not authenticated"));
}

/**
 * Mocks requireAuth to return a user ID
 */
export function mockRequireAuth(userId: string = "user-123"): Mock {
  return vi.fn().mockResolvedValue(userId);
}

/**
 * Mocks requireAuth to throw UnauthorizedError
 */
export function mockRequireAuthUnauthorized(): Mock {
  return vi.fn().mockRejectedValue(new UnauthorizedError("Not authenticated"));
}

/**
 * Mocks getSession to return a session
 */
export function mockGetSession(
  session: typeof mockSession = mockSession,
): Mock {
  return vi.fn().mockResolvedValue(session);
}

/**
 * Mocks getSession to return null (not authenticated)
 */
export function mockGetSessionNull(): Mock {
  return vi.fn().mockResolvedValue(null);
}

/**
 * Mocks admin session check
 */
export function mockAdminSession(
  adminSession: typeof mockAdminSessionData = mockAdminSessionData,
): Mock {
  return vi.fn().mockResolvedValue(adminSession);
}

