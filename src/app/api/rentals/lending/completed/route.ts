import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

export async function GET() {
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
        return await rentalDAL.getLendingRentalsByStatus("completed", userId);
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
