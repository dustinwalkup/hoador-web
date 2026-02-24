import { rentalDAL } from "@/dal";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

async function getHandler() {
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

    const { data, error } = await tryCatch(
      (async () => {
        return await rentalDAL.getRentalsByStatus("active", userId);
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
  "GET /api/rentals/renting/active",
);
