import { QuickActionsBar } from "@/features/dashboard/components";
import { runWithQueryCounter } from "@/db/query-tracker";
import { getUnreadMessageCountCached } from "@/features/dashboard/lib";
import { safe } from "./safe";

export async function QuickActionsWidget({ userId }: { userId: string }) {
  return runWithQueryCounter("RSC widget:quick-actions", async () => {
    const unreadCount = await safe(
      () => getUnreadMessageCountCached(userId),
      0,
    );
    return <QuickActionsBar unreadCount={unreadCount} />;
  });
}
