import { UnreadMessagesWidget } from "@/features/dashboard/components";
import { messagesDAL } from "@/dal";
import { getUnreadMessageCountCached } from "./cached-fetchers";
import { safe } from "./safe";

export async function UnreadMessagesWidgetIsland({
  userId,
}: {
  userId: string;
}) {
  const [unreadCount, recentConversations] = await Promise.all([
    safe(() => getUnreadMessageCountCached(userId), 0),
    safe(
      () => messagesDAL.getUserConversationsPaginated(userId, false, 0, 3),
      [],
    ),
  ]);

  return (
    <UnreadMessagesWidget
      unreadCount={unreadCount}
      recentConversations={recentConversations}
    />
  );
}
