import { communityDAL } from "@/dal";
import { cache } from "react";
import type { UserCommunityInfo } from "@/db/schemas/communities.schema";
import { getCurrentUserId } from "@/features/auth/utils/session";

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
    const userId = await getCurrentUserId();
    if (!userId) {
      return null;
    }

    return communityDAL.getUserCommunityId(userId);
  },
);
