import { listingDAL } from "@/dal";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import { getAuthenticatedUserResponse } from "@/lib/api/route-helpers";
async function getHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof Response) return authResult;

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
