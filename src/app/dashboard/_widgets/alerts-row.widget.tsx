import {
  OverdueAlertsWidget,
  UpcomingScheduleWidget,
} from "@/features/dashboard/components";
import { getUpcomingSchedule } from "@/features/dashboard/lib";
import { StaggerGrid, StaggerItem } from "@/components/animation-section";
import { runWithQueryCounter } from "@/db/query-tracker";
import { getActionableAlertsCached } from "@/features/dashboard/lib";
import { safe } from "./safe";

export async function AlertsRowWidget({ userId }: { userId: string }) {
  return runWithQueryCounter("RSC widget:alerts-row", async () => {
    const [upcomingSchedule, actionableAlerts] = await Promise.all([
      safe(() => getUpcomingSchedule(userId), []),
      safe(() => getActionableAlertsCached(userId), []),
    ]);

    const hasAlerts = actionableAlerts.length > 0;

    return (
      <StaggerGrid
        className={`grid gap-4 ${hasAlerts ? "lg:grid-cols-2" : ""}`}
        delay={0.15}
      >
        <StaggerItem>
          <div id="coming-up">
            <UpcomingScheduleWidget entries={upcomingSchedule} />
          </div>
        </StaggerItem>
        {hasAlerts && (
          <StaggerItem>
            <div id="needs-attention">
              <OverdueAlertsWidget alerts={actionableAlerts} />
            </div>
          </StaggerItem>
        )}
      </StaggerGrid>
    );
  });
}
