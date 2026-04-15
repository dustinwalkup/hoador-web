import { RecentActivityFeed } from "@/features/dashboard/components";
import { getDashboardActivityFeed } from "@/features/dashboard/lib";
import { safe } from "./safe";

export async function RecentActivityWidget({ userId }: { userId: string }) {
  const items = await safe(() => getDashboardActivityFeed(userId, 10), []);
  return <RecentActivityFeed items={items} />;
}
