import { requireAuth } from "./session";

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
 * Helper to check if user is admin
 * TODO: Implement admin checking when auth system is in place
 */
export async function isAdmin(): Promise<boolean> {
  // TODO: Implement admin checking when auth system is in place
  return false;
}
