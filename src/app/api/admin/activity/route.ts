import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { userDAL, disputeDAL } from "@/dal";
import { formatDistanceToNow } from "@/lib/utils/date.utils";

export interface AdminActivityItem {
  id: string;
  title: string;
  description?: string;
  relativeTime: string;
  linkTo?: string;
}

/**
 * GET /api/admin/activity
 * Returns recent platform activity for admin dashboard: new user signups and dispute activity.
 * Requires admin authentication.
 */
async function getHandler() {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) {
      return adminError;
    }

    const [usersResult, disputesResult] = await Promise.all([
      userDAL.getUsersForAdmin({ page: 1, limit: 5 }),
      disputeDAL.getAdminDisputes({ page: 1, limit: 5 }),
    ]);

    const items: Array<{
      id: string;
      title: string;
      description?: string;
      relativeTime: string;
      linkTo?: string;
      sortAt: number;
    }> = [];

    for (const u of usersResult.data) {
      const createdAt = new Date(u.createdAt);
      items.push({
        id: `user-${u.id}`,
        title: "New user registration",
        description: u.name || u.email,
        relativeTime: formatDistanceToNow(createdAt, { addSuffix: true }),
        linkTo: `/admin/users/${u.id}`,
        sortAt: createdAt.getTime(),
      });
    }

    for (const d of disputesResult.data) {
      const createdAt = new Date(d.createdAt);
      const listingName = d.rental?.listing?.name ?? "Listing";
      items.push({
        id: `dispute-${d.id}`,
        title: "Dispute opened",
        description: listingName,
        relativeTime: formatDistanceToNow(createdAt, { addSuffix: true }),
        linkTo: `/admin/dashboard/disputes/review?dispute=${d.id}`,
        sortAt: createdAt.getTime(),
      });
    }

    items.sort((a, b) => b.sortAt - a.sortAt);
    const feed = items.slice(0, 10).map(
      ({
        id,
        title,
        description,
        relativeTime,
        linkTo,
      }): AdminActivityItem => ({
        id,
        title,
        description,
        relativeTime,
        linkTo,
      }),
    );

    return NextResponse.json(feed);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/admin/activity");
