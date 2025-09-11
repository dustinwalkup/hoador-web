"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/services/better-auth/client";
import { resendVerificationEmailAction } from "../actions/complete-onboarding.action";

/**
 * User status types
 */
type UserStatus =
  | "pending_verification"
  | "active"
  | "incomplete_profile"
  | "suspended"
  | "inactive";

/**
 * Better Auth user interface (extended)
 */
interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: string;
  bio?: string;
}

/**
 * User profile interface
 */
interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  status: UserStatus;
  emailVerified: boolean;
  profileImageUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session state interface
 */
interface SessionState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  isOnboarded: boolean;
  canAccessApp: boolean;
  requiresVerification: boolean;
  requiresOnboarding: boolean;
}

/**
 * Hook for managing user session and authentication state
 * Provides session management, user status checking, and auth actions
 */
export function useSession() {
  const router = useRouter();

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isVerified: false,
    isOnboarded: false,
    canAccessApp: false,
    requiresVerification: false,
    requiresOnboarding: false,
  });

  /**
   * Update session state based on user data
   */
  const updateSessionState = useCallback((user: UserProfile | null) => {
    const isAuthenticated = !!user;
    const isVerified = user?.emailVerified || false;
    const isOnboarded = user?.status === "active";
    const requiresVerification = user?.status === "pending_verification";
    const requiresOnboarding = user?.status === "incomplete_profile";
    const canAccessApp = isAuthenticated && isVerified && isOnboarded;

    setSessionState({
      user,
      isLoading: false,
      isAuthenticated,
      isVerified,
      isOnboarded,
      canAccessApp,
      requiresVerification,
      requiresOnboarding,
    });
  }, []);

  /**
   * Load current session
   */
  const loadSession = useCallback(async () => {
    try {
      const session = await authClient.getSession();

      if (session?.data?.user) {
        // Transform Better Auth user to our UserProfile format
        const authUser = session.data.user as BetterAuthUser;
        const userProfile: UserProfile = {
          id: authUser.id,
          email: authUser.email,
          firstName: authUser.firstName || "",
          lastName: authUser.lastName || "",
          name: authUser.name || "",
          phone: authUser.phone || "",
          status: (authUser.status as UserStatus) || "incomplete_profile",
          emailVerified: authUser.emailVerified || false,
          profileImageUrl: authUser.image || undefined,
          bio: authUser.bio || undefined,
          createdAt: new Date(authUser.createdAt),
          updatedAt: new Date(authUser.updatedAt),
        };

        updateSessionState(userProfile);
      } else {
        updateSessionState(null);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      updateSessionState(null);
    }
  }, [updateSessionState]);

  /**
   * Sign out user
   */
  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
      updateSessionState(null);
      router.push("/");

      toast.success("You have been successfully signed out.");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out. Please try again.");
    }
  }, [router, updateSessionState]);

  /**
   * Resend verification email
   */
  const resendVerificationEmail = useCallback(async () => {
    try {
      const formData = new FormData();
      const result = await resendVerificationEmailAction(
        { success: false },
        formData,
      );

      if (result.success) {
        toast.success(
          result.message || "Please check your inbox and spam folder.",
        );
      } else {
        toast.error(result.error || "Failed to resend verification email.");
      }
    } catch (error) {
      console.error("Resend verification email error:", error);
      toast.error("Failed to resend verification email. Please try again.");
    }
  }, []);

  /**
   * Refresh session data
   */
  const refreshSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  /**
   * Check if user can access a specific route
   */
  const canAccessRoute = useCallback(
    (route: string) => {
      if (!sessionState.isAuthenticated) {
        return false;
      }

      // Public routes that don't require authentication
      const publicRoutes = ["/", "/explore", "/listings"];
      if (publicRoutes.includes(route)) {
        return true;
      }

      // Routes that require authentication but not verification
      const authOnlyRoutes = [
        "/auth/signup",
        "/auth/login",
        "/auth/verify-email",
      ];
      if (authOnlyRoutes.includes(route)) {
        return sessionState.isAuthenticated;
      }

      // Routes that require verification but not onboarding
      const verifiedRoutes = ["/auth/onboarding"];
      if (verifiedRoutes.includes(route)) {
        return sessionState.isAuthenticated && sessionState.isVerified;
      }

      // All other routes require full access
      return sessionState.canAccessApp;
    },
    [sessionState],
  );

  /**
   * Get redirect URL based on user status
   */
  const getRedirectUrl = useCallback(() => {
    if (!sessionState.isAuthenticated) {
      return "/auth/login";
    }

    if (sessionState.requiresVerification) {
      return "/auth/verify-email";
    }

    if (sessionState.requiresOnboarding) {
      return "/auth/onboarding";
    }

    return "/dashboard";
  }, [sessionState]);

  /**
   * Handle authentication redirects
   */
  const handleAuthRedirect = useCallback(() => {
    const redirectUrl = getRedirectUrl();
    if (redirectUrl !== window.location.pathname) {
      router.push(redirectUrl);
    }
  }, [getRedirectUrl, router]);

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Handle auth redirects when session state changes
  useEffect(() => {
    if (!sessionState.isLoading) {
      handleAuthRedirect();
    }
  }, [sessionState, handleAuthRedirect]);

  return {
    // Session state
    ...sessionState,

    // Actions
    signOut,
    resendVerificationEmail,
    refreshSession,
    loadSession,

    // Helpers
    canAccessRoute,
    getRedirectUrl,
    handleAuthRedirect,

    // User data helpers
    userDisplayName: sessionState.user
      ? `${sessionState.user.firstName} ${sessionState.user.lastName}`.trim() ||
        sessionState.user.name
      : "",
    userInitials: sessionState.user
      ? `${sessionState.user.firstName?.[0] || ""}${sessionState.user.lastName?.[0] || ""}`.toUpperCase()
      : "",
  };
}

/**
 * Hook for checking if user can access a specific route
 * Useful for route guards and conditional rendering
 */
export function useRouteAccess(route: string) {
  const { canAccessRoute, isLoading } = useSession();

  return {
    canAccess: canAccessRoute(route),
    isLoading,
  };
}

/**
 * Hook for authentication guards
 * Automatically redirects unauthenticated users
 */
export function useAuthGuard(
  requiredStatus: "authenticated" | "verified" | "onboarded" = "onboarded",
) {
  const {
    isAuthenticated,
    isVerified,
    isOnboarded,
    isLoading,
    getRedirectUrl,
  } = useSession();

  const canAccess = (() => {
    if (isLoading) return false;
    if (requiredStatus === "authenticated") return isAuthenticated;
    if (requiredStatus === "verified") return isAuthenticated && isVerified;
    if (requiredStatus === "onboarded")
      return isAuthenticated && isVerified && isOnboarded;
    return false;
  })();

  return {
    canAccess,
    isLoading,
    redirectUrl: getRedirectUrl(),
  };
}
