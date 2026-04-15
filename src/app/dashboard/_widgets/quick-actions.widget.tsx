import { QuickActionsBar } from "@/features/dashboard/components";
import { getUnreadMessageCountCached } from "./cached-fetchers";
import { safe } from "./safe";

export async function QuickActionsWidget({ userId }: { userId: string }) {
  const unreadCount = await safe(() => getUnreadMessageCountCached(userId), 0);
  return <QuickActionsBar unreadCount={unreadCount} />;
}
