import { userDAL } from "../dal";

export async function getCurrentUser() {
  // 🔧 Replace this with Clerk auth later
  const USER_ID = "de468487-b35e-406e-aedb-58846e1704cd";

  // You could hardcode or use cookies/session logic for local dev
  return userDAL.getUserById(USER_ID);
}

// Helper function to require authentication (mimics Clerk pattern)
export async function requireAuth() {
  const auth = await getCurrentUser();

  if (!auth.id) {
    throw new Error("Authentication required");
  }

  return auth;
}

// Helper to get just the user ID (most common use case)
export async function getCurrentUserId(): Promise<string | null> {
  const auth = await getCurrentUser();
  return auth.id;
}

// Helper to check if user has specific permission
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function hasPermission(permission: string): Promise<boolean> {
  // TODO: Implement permission checking when auth system is in place
  return false;
}

// Helper to check if user is admin
export async function isAdmin(): Promise<boolean> {
  // TODO: Implement admin checking when auth system is in place
  return false;
}
