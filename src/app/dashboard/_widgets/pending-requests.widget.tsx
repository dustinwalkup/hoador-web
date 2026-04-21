import { PendingRequestsWidget } from "@/features/dashboard/components";
import { runWithQueryCounter } from "@/db/query-tracker";
import { getLendingRequestDetailUrl } from "@/features/dashboard/lib/urls";
import type { PendingRequestItem } from "@/features/dashboard/types";
import {
  getLendingRequestsByStatusCached,
  findServiceBookingsByProviderCached,
} from "@/features/dashboard/lib";
import { safe } from "./safe";

export async function PendingRequestsWidgetIsland({
  userId,
}: {
  userId: string;
}) {
  return runWithQueryCounter("RSC widget:pending-requests", async () => {
    const [pendingLendingRequests, serviceBookingsAsProvider] =
      await Promise.all([
        safe(() => getLendingRequestsByStatusCached("pending", userId), []),
        safe(() => findServiceBookingsByProviderCached(userId), []),
      ]);

    const pendingServiceBookings = serviceBookingsAsProvider.filter(
      (b) => b.status === "pending",
    );

    const rentalItems: PendingRequestItem[] = pendingLendingRequests
      .slice(0, 5)
      .map((req) => ({
        id: req.id,
        listingName: req.listingName,
        requesterName: req.renterName,
        statusText: "Awaiting your response",
        requestDetailUrl: getLendingRequestDetailUrl(req.id),
      }));

    const serviceItems: PendingRequestItem[] = pendingServiceBookings
      .slice(0, 5)
      .map((b) => ({
        id: b.id,
        listingName: b.listingTitle,
        requesterName: `${b.counterparty.firstName} ${b.counterparty.lastName}`,
        statusText: "Awaiting your confirmation",
        requestDetailUrl: `/dashboard/services/bookings/${b.id}`,
      }));

    return (
      <PendingRequestsWidget
        rentalItems={rentalItems}
        rentalTotalCount={pendingLendingRequests.length}
        serviceItems={serviceItems}
        serviceTotalCount={pendingServiceBookings.length}
      />
    );
  });
}
