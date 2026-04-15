import { PendingRequestsWidget } from "@/features/dashboard/components";
import { rentalDAL } from "@/dal";
import { getLendingRequestDetailUrl } from "@/features/dashboard/lib/urls";
import type { PendingRequestItem } from "@/features/dashboard/types";
import { safe } from "./safe";

export async function PendingRequestsWidgetIsland({
  userId,
}: {
  userId: string;
}) {
  const pendingLendingRequests = await safe(
    () => rentalDAL.getLendingRequestsByStatus("pending", userId),
    [],
  );

  const items: PendingRequestItem[] = pendingLendingRequests
    .slice(0, 5)
    .map((req) => ({
      id: req.id,
      listingName: req.listingName,
      requesterName: req.renterName,
      statusText: "Awaiting your response",
      requestDetailUrl: getLendingRequestDetailUrl(req.id),
    }));

  return (
    <PendingRequestsWidget
      items={items}
      totalCount={pendingLendingRequests.length}
    />
  );
}
