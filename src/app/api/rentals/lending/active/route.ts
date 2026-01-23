import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

/**
 * GET /api/rentals/lending/active
 * Get all active lending rentals
 */
export async function GET() {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { data, error } = await tryCatch(
      (async () => {
        return await rentalDAL.getLendingRentalsByStatus("active");
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
