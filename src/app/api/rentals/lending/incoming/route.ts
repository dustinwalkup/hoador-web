import { NextRequest } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

async function getHandler(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    // Get current user ID
    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const userId = await getCurrentUserId();
    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status =
      (searchParams.get("status") as
        | "pending"
        | "approved"
        | "denied"
        | "active"
        | "completed"
        | "cancelled") || "pending";

    const { data, error } = await tryCatch(
      (async () => {
        if (status === "active" || status === "completed") {
          return await rentalDAL.getLendingRentalsByStatus(status, userId);
        }
        return await rentalDAL.getLendingRequestsByStatus(status, userId);
      })(),
    );

    if (error) {
      return handleApiError(error);
    }

    return Response.json({ data, status: "success" });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/rentals/lending/incoming",
);
