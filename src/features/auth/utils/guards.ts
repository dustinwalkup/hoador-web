import { requireAuth, getCurrentUser } from "./session";

/**
 * Require user to have active status (completed onboarding)
 */
export const requireActiveUser = async () => {
  const user = await requireAuth();
  if (user.status !== "active") {
    throw new Error(`User status is ${user.status}, active status required`);
  }
  return user;
};

/**
 * Helper to check if user has specific permission
 * TODO: Implement permission checking when auth system is in place
 */
// export async function hasPermission(permission: string): Promise<boolean> {
//   // TODO: Implement permission checking when auth system is in place
//   return false;
// }

/**
 * Helper to check if user is admin (admin or superadmin)
 * Returns false if user is not authenticated
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.userType === "admin" || user.userType === "superadmin";
}

/**
 * Helper to check if user is superadmin
 * Returns false if user is not authenticated
 */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.userType === "superadmin";
}

/**
 * Require admin privileges (admin or superadmin)
 * Throws if user is not authenticated or not admin/superadmin
 */
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.userType !== "admin" && user.userType !== "superadmin") {
    throw new Error("Admin privileges required");
  }
  return user;
}

/**
 * Require superadmin privileges
 * Throws if user is not authenticated or not superadmin
 */
export async function requireSuperAdmin() {
  const user = await requireAuth();
  if (user.userType !== "superadmin") {
    throw new Error("Superadmin privileges required");
  }
  return user;
}
