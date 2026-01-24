import { NextRequest } from "next/server";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import { handleApiError, requireAuthResponse } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
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
      (searchParams.get("status") as "pending" | "approved" | "denied") ||
      "pending";

    const { data, error } = await tryCatch(
      (async () => {
        return await rentalDAL.getRentalRequestsByStatus(status, userId);
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
