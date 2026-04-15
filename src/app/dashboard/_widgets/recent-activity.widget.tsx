import { RecentActivityFeed } from "@/features/dashboard/components";
import { getDashboardActivityFeed } from "@/features/dashboard/lib";
import { runWithQueryCounter } from "@/db/query-tracker";
import { safe } from "./safe";

export async function RecentActivityWidget({ userId }: { userId: string }) {
  return runWithQueryCounter("RSC widget:recent-activity", async () => {
    const items = await safe(() => getDashboardActivityFeed(userId, 10), []);
    return <RecentActivityFeed items={items} />;
  });
}
