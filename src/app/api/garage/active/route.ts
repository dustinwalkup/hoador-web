import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { listingDAL } from "@/dal";
import type { GarageListingFilters } from "@/dal/listing.dal";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = await getCurrentUserId();

    if (!userId) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse search parameters into GarageListingFilters
    const filters: GarageListingFilters = {
      query: searchParams.get("q") || undefined,
      categoryId: searchParams.get("category") || undefined,
      sortBy:
        (searchParams.get("sortBy") as "newest" | "name" | "lastRented") ||
        undefined,
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || undefined,
      rentalStatus:
        (searchParams.get("rentalStatus") as "available" | "rented") ||
        undefined,
    };

    const activeListings = await listingDAL.getUserActiveListingsWithFilters(
      userId,
      filters,
    );

    return Response.json(activeListings);
  } catch (error) {
    console.error("Active listings API error:", error);
    return Response.json(
      { error: "Failed to fetch active listings" },
      { status: 500 },
    );
  }
}
