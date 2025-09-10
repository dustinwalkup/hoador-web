import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/features/auth/auth.utils";
import { listingDAL } from "@/dal";
import type { ListingSearchFilters } from "@/dal/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = await getCurrentUserId();

    // Parse search parameters
    const filters: ListingSearchFilters = {
      query: searchParams.get("q") || undefined,
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
      deliveryAvailable: searchParams.get("delivery") === "true",
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
      userId || undefined,
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
