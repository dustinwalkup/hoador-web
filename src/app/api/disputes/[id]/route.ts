import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { disputeDAL, rentalDAL } from "@/dal";

/**
 * GET /api/disputes/[id]
 * Get dispute details by ID
 * Accessible by renter, provider, or admin
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId, isAdmin } = authResult;

    const { id } = await params;

    // Get dispute with all relations
    const dispute = await disputeDAL.getById(id);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Verify user has access (renter, provider, or admin)
    if (!isAdmin) {
      // Get rental to check user access
      const rental = await rentalDAL.getRentalDetailsById(
        dispute.rentalId,
        userId,
      );

      if (!rental) {
        return NextResponse.json(
          { error: "Rental not found" },
          { status: 404 },
        );
      }

      const isRenter = rental.renterId === userId;
      const isProvider = rental.ownerId === userId;

      if (!isRenter && !isProvider) {
        return NextResponse.json(
          { error: "Access denied. You can only view your own disputes." },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(dispute);
  } catch (error) {
    return handleApiError(error);
  }
}
