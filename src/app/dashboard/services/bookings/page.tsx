export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/page-header";
import { serviceBookingDAL } from "@/dal";
import { ServiceBookingsClient } from "@/features/services/components/service-bookings-client";
import { getCurrentUserId } from "@/features/auth/utils/session";

export const metadata = {
  title: "Service bookings",
};

export default async function ServiceBookingsPage() {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const [booked, providing] = await Promise.all([
    serviceBookingDAL.findByRequesterForDashboard(userId),
    serviceBookingDAL.findByProviderForDashboard(userId),
  ]);

  return (
    <div className="container pb-6">
      <PageHeader
        title="Service bookings"
        description="Track requests you’ve made and jobs you’re providing."
      />
      <ServiceBookingsClient booked={booked} providing={providing} />
    </div>
  );
}
