import { ActiveDisputesWidget } from "@/features/dashboard/components";
import { disputeDAL } from "@/dal";
import { safe } from "./safe";

const DISPUTES_FALLBACK = {
  data: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
};

export async function ActiveDisputesWidgetIsland({
  userId,
}: {
  userId: string;
}) {
  const disputesResult = await safe(
    () => disputeDAL.getUserDisputes(userId, { limit: 20 }),
    DISPUTES_FALLBACK,
  );

  const activeDisputes = disputesResult.data.filter(
    (d) => d.status !== "closed",
  );

  return (
    <ActiveDisputesWidget
      disputes={activeDisputes.slice(0, 5)}
      totalCount={activeDisputes.length}
    />
  );
}
