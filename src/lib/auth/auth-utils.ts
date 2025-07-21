import { auth } from "./index";
import { headers } from "next/headers";

export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    // Return the user from the session, but you can also fetch additional data from your DAL if needed
    return session.user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

// Helper function to require authentication
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}

// Helper to get just the user ID (most common use case)
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

// Helper to get session information
export async function getCurrentSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}

// Helper to check if user has specific permission
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function hasPermission(permission: string): Promise<boolean> {
  // TODO: Implement permission checking based on your user roles/permissions
  const user = await getCurrentUser();
  if (!user) return false;

  // You can implement role-based permissions here
  // For example, check user.status or a roles table
  return false;
}

// Helper to check if user is admin
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  // TODO: Implement admin checking based on your business logic
  // For example, check if user.status === 'admin' or check a roles table
  return false;
}

// Helper to check if user email is verified
export async function isEmailVerified(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.emailVerified || false;
}

// Export session utilities for use in components/pages
export { auth } from "./index";
