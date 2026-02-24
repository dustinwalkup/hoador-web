import { NextRequest } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { rentalDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

/**
 * GET /api/rentals/[id]
 * Get a rental details by ID
 * Only accessible by the owner, renter, or admin
 */
async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication and get user info in one call
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof Response) return authResult; // Error response

    const { userId, isAdmin } = authResult;
    const { id } = await params;

    // Fetch rental details
    const { data, error } = await tryCatch(
      (async () => {
        return await rentalDAL.getRentalDetailsById(id, userId);
      })(),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!data) {
      return Response.json({ error: "Rental not found" }, { status: 404 });
    }

    // Authorization check: user must be owner, renter, or admin
    if (!isAdmin && data.renterId !== userId && data.ownerId !== userId) {
      return Response.json(
        { error: "Access denied. You can only view your own rentals." },
        { status: 403 },
      );
    }

    return Response.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/rentals/[id]");
