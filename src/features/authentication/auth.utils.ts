import { userDAL } from "@/dal";
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  // 🔧 Replace this with Clerk auth later
  const USER_ID = "0b38f47b-c51c-4c3f-a583-a1dee5d43163";

  // You could hardcode or use cookies/session logic for local dev
  return userDAL.getUserById(USER_ID);
});

// Helper function to require authentication (mimics Clerk pattern)
export const requireAuth = cache(async () => {
  const auth = await getCurrentUser();
  if (!auth.id) {
    throw new Error("Authentication required");
  }
  return auth;
});

// Helper to get just the user ID (most common use case)
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const auth = await getCurrentUser();
  return auth.id;
});

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
