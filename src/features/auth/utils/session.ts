import { cache } from "react";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/services/better-auth";
import { getSessionCookie as getSessionCookieFromCookies } from "@/features/auth/utils/session";
import { userDAL } from "@/dal";

/**
 * Get current user from Better Auth session
 */
export const getCurrentUser = async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    // Get full user profile from our DAL
    const userProfile = await userDAL.getUserByEmailForAuth(session.user.email);
    return userProfile;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
};

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
 * Get Better Auth session cookie directly
 */
export function getSessionCookie(request: NextRequest) {
  return getSessionCookieFromCookies(request);
}
