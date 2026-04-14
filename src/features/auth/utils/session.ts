import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/services/better-auth";

/**
 * Get current user from Better Auth session
 */
export const getCurrentUser = cache(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    // Lazy import userDAL to avoid circular dependency
    // (rentals.dal.ts imports getCurrentUserId from this file,
    // and dal/index.ts imports rentals.dal.ts, creating a cycle)
    const { userDAL } = await import("@/dal");

    // Get full user profile from our DAL
    const userProfile = await userDAL.getUserByEmailForAuth(session.user.email);
    return userProfile;
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
