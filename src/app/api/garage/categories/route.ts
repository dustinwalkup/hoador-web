import { listingDAL } from "@/dal";

import { withRequestLogging } from "@/lib/api/with-request-logging";
async function getHandler() {
  try {
    const categories = await listingDAL.getListingCategories();

    return Response.json(categories);
  } catch (error) {
    console.error("Categories API error:", error);
    return Response.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/garage/categories");
