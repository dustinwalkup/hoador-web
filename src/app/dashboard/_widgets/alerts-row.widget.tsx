import {
  OverdueAlertsWidget,
  UpcomingScheduleWidget,
} from "@/features/dashboard/components";
import { getUpcomingSchedule } from "@/features/dashboard/lib";
import { rentalDAL } from "@/dal";
import { StaggerGrid, StaggerItem } from "@/components/animation-section";
import { safe } from "./safe";

export async function AlertsRowWidget({ userId }: { userId: string }) {
  const [upcomingSchedule, actionableAlerts] = await Promise.all([
    safe(() => getUpcomingSchedule(userId), []),
    safe(() => rentalDAL.getActionableAlerts(userId), []),
  ]);

  const hasAlerts = actionableAlerts.length > 0;

  return (
    <StaggerGrid
      className={`grid gap-4 ${hasAlerts ? "lg:grid-cols-2" : ""}`}
      delay={0.15}
    >
      <StaggerItem>
        <UpcomingScheduleWidget entries={upcomingSchedule} />
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
}
