import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

export async function GET() {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { data, error } = await tryCatch(
      (async () => {
        return await rentalDAL.getRentalsByStatus("active");
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
