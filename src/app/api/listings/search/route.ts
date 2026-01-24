import { NextRequest, NextResponse } from "next/server";
import { listingDAL } from "@/dal";
import type { ListingSearchFilters } from "@/dal/types";
import { sanitizeSearchQuery } from "@/lib/utils/sanitize";
import { getCurrentUserCommunityId } from "@/features/community/utils/membership";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId, isAdmin: userIsAdmin } = authResult;

    const searchParams = request.nextUrl.searchParams;

    // Get user's community ID
    const communityId = await getCurrentUserCommunityId();
    if (!communityId) {
      return NextResponse.json(
        { error: "User must be a member of a community" },
        { status: 400 },
      );
    }

    // Parse and sanitize search parameters
    const rawQuery = searchParams.get("q");
    const filters: ListingSearchFilters = {
      query: rawQuery ? sanitizeSearchQuery(rawQuery) : undefined,
      categoryId: searchParams.get("category") || undefined,
      minPrice: searchParams.get("minPrice")
        ? parseFloat(searchParams.get("minPrice")!)
        : undefined,
      maxPrice: searchParams.get("maxPrice")
        ? parseFloat(searchParams.get("maxPrice")!)
        : undefined,
      condition: searchParams.get("condition")
        ? searchParams.get("condition")!.split(",").filter(Boolean)
        : undefined,
      deliveryMode:
        (searchParams.get("delivery") as
          | "pickup_only"
          | "delivery_only"
          | "both_available") || undefined,
      setupAvailable: searchParams.get("setup") === "true" ? true : undefined,
      availableNow:
        searchParams.get("availableNow") === "true" ? true : undefined,
      sortBy:
        (searchParams.get("sortBy") as
          | "price"
          | "rating"
          | "distance"
          | "newest") || "newest",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
    };

    const pagination = {
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "12"),
    };

    const searchResults = await listingDAL.searchListings(
      filters,
      pagination,
      userId,
      communityId,
      userIsAdmin,
    );

    return Response.json(searchResults);
  } catch (error) {
    console.error("Listing search error:", error);
    return Response.json(
      { error: "Failed to search listings" },
      { status: 500 },
    );
  }
}
