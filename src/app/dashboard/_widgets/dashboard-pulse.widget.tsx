import { DashboardPulse } from "@/features/dashboard/components/dashboard-pulse";
import { getDashboardPulseData } from "@/features/dashboard/lib";
import { safe } from "./safe";

const PULSE_FALLBACK = {
  action: {
    pendingRequests: 0,
    overdueReturns: 0,
    overdueServices: 0,
    unconfirmedServices: 0,
  },
  active: { borrowing: 0, lending: 0, disputes: 0 },
  upcoming: { rentals: 0, services: 0 },
  listed: { tools: 0, services: 0 },
};

export async function DashboardPulseWidget({ userId }: { userId: string }) {
  const data = await safe(() => getDashboardPulseData(userId), PULSE_FALLBACK);
  return <DashboardPulse data={data} />;
}
