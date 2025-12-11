import { getCurrentUser } from "./session";
import type { UserProfile } from "@/dal/types";

/**
 * Get admin user (admin or superadmin)
 * Returns null if user is not authenticated or not an admin
 */
export async function getAdminUser(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  if (user.userType === "admin" || user.userType === "superadmin") {
    return user;
  }
  return null;
}

/**
 * Get superadmin user
 * Returns null if user is not authenticated or not a superadmin
 */
export async function getSuperAdminUser(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  if (user.userType === "superadmin") {
    return user;
  }
  return null;
}
