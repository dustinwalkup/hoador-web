import { listingDAL } from "@/dal";

import { withRequestLogging } from "@/lib/api/with-request-logging";
async function getHandler() {
  try {
    const categories = await listingDAL.getListingCategories();
    return Response.json(categories);
  } catch (error) {
    console.error("Listing categories error:", error);
    return Response.json(
      { error: "Failed to fetch listing categories" },
      { status: 500 },
    );
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/listings/categories",
);
