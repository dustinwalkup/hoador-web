import { NextRequest } from "next/server";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const status =
      (searchParams.get("status") as
        | "pending"
        | "approved"
        | "denied"
        | "active"
        | "completed") || "pending";

    const { data, error } = await tryCatch(
      (async () => {
        if (status === "active" || status === "completed") {
          return await rentalDAL.getLendingRentalsByStatus(status);
        }
        return await rentalDAL.getLendingRequestsByStatus(status);
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
