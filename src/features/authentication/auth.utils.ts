import { userDAL, communityDAL } from "@/dal";
import { cache } from "react";
import type { UserCommunityInfo } from "@/db/schemas/communities.schema";

export const getCurrentUser = cache(async () => {
  // 🔧 Replace this with Clerk auth later
  const USER_ID = "195f339a-228d-4d98-b0a1-568359e8d1e8";

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

// Helper to get current user's community information
export const getCurrentUserCommunity = cache(
  async (): Promise<UserCommunityInfo | null> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    return communityDAL.getMembershipForUser(userId);
  },
);

// Helper to require user to have community membership
export const requireCommunityMembership = cache(
  async (): Promise<UserCommunityInfo> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error("Authentication required");
    }

    return communityDAL.requireUserCommunityMembership(userId);
  },
);

// Helper to get current user's community ID
export const getCurrentUserCommunityId = cache(
  async (): Promise<string | null> => {
    return communityDAL.getCurrentUserCommunityId();
  },
);

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
