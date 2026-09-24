import { NextRequest } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";
import type { GarageListingFilters } from "@/dal/listing.dal";

async function getHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // Parse search parameters into GarageListingFilters
    const filters: GarageListingFilters = {
      query: searchParams.get("q") || undefined,
      categoryId: searchParams.get("category") || undefined,
      sortBy:
        (searchParams.get("sortBy") as "newest" | "name" | "lastRented") ||
        undefined,
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || undefined,
      // Note: rentalStatus is not applicable for inactive listings
    };

    const inactiveListings =
      await listingDAL.getUserInactiveListingsWithFilters(userId, filters);

    return Response.json(inactiveListings);
  } catch (error) {
    console.error("Inactive listings API error:", error);
    return Response.json(
      { error: "Failed to fetch inactive listings" },
      { status: 500 },
    );
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/garage/inactive");
