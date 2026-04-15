import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/services/better-auth";
import { getRequestContext } from "@/lib/logger";
import type { UserProfile } from "@/dal/types";

type CachedUser = UserProfile | null;

/**
 * Get current user from Better Auth session.
 *
 * Memoization strategy:
 *   1. ALS request-context slot (set by withRequestLogging) — dedupes across
 *      call sites in a single route handler. React.cache() doesn't do this
 *      in App Router route handlers; ALS is the reliable path.
 *   2. React.cache() — dedupes within a single RSC render for code paths
 *      outside withRequestLogging (layouts, pages, server components).
 *
 * Hot path: PK lookup via userDAL.getUserForAuth(id). No preferences, no
 * addresses, no stats aggregate. Callers that need those must fetch them
 * explicitly.
 */
export const getCurrentUser = cache(async (): Promise<CachedUser> => {
  const ctx = getRequestContext();

  // ALS fast path: already resolved in this request.
  if (ctx && "user" in ctx && ctx.user !== undefined) {
    return ctx.user as CachedUser;
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      if (ctx) ctx.user = null;
      return null;
    }

    // Lazy import userDAL to avoid circular dependency
    // (rentals.dal.ts imports getCurrentUserId from this file,
    // and dal/index.ts imports rentals.dal.ts, creating a cycle)
    const { userDAL } = await import("@/dal");

    const userProfile = await userDAL.getUserForAuth(session.user.id);
    const resolved: CachedUser = userProfile ?? null;
    if (ctx) ctx.user = resolved;
    return resolved;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
});

/**
 * Require authentication - throws if user not authenticated
 */
export const requireAuth = async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
};

/**
 * Get current user ID (most common use case)
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id || null;
});

/**
 * Require user to be verified (email verified)
 */
export const requireVerifiedUser = cache(async () => {
  const user = await requireAuth();
  if (!user.emailVerified) {
    throw new Error("Email verification required");
  }
  return user;
});

/**
 * Get Better Auth session directly
 */
export const getSession = cache(async (requestHeaders?: Headers) => {
  try {
    const session = await auth.api.getSession({
      headers: requestHeaders || (await headers()),
    });
    return session;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
});

/**
 * Get authenticated user with admin status
 * Returns null if not authenticated, otherwise returns user data with admin flag
 * Use this in server components and server actions
 */
export async function getAuthenticatedUser(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  userId: string;
  isAdmin: boolean;
} | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const isAdmin = user.userType === "admin" || user.userType === "superadmin";
  return { user, userId: user.id, isAdmin };
}

/**
 * Require authenticated user with admin status
 * Throws if not authenticated, otherwise returns user data with admin flag
 * Use this in server components and server actions when auth is required
 */
export async function requireAuthenticatedUser(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  userId: string;
  isAdmin: boolean;
}> {
  const result = await getAuthenticatedUser();
  if (!result) {
    throw new Error("Authentication required");
  }
  return result;
}
