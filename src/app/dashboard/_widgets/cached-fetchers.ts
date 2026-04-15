import { cache } from "react";
import { messagesDAL } from "@/dal";

/**
 * Request-deduped wrapper so QuickActions and UnreadMessages widgets
 * can independently await the unread count without double-fetching.
 */
export const getUnreadMessageCountCached = cache((userId: string) =>
  messagesDAL.getUnreadMessageCount(userId),
);
