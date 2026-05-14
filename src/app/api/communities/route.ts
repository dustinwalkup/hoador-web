import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { communityDAL } from "@/dal";
import {
  handleApiError,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import { NotFoundError } from "@/dal/errors";

/**
 * GET /api/communities?networkSlug=kansas-city-metro&active=true
 * Lists communities, optionally scoped to a network and active-only.
 * Used by the community-select dropdown. Authenticated.
 *
 * Without `networkSlug` this returns nothing useful for the dropdown, so it
 * is required; the dropdown always queries by network.
 */
async function getHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const networkSlug = searchParams.get("networkSlug");
    const activeOnly = searchParams.get("active") !== "false";

    if (!networkSlug) {
      return NextResponse.json(
        { error: "networkSlug is required" },
        { status: 400 },
      );
    }

    const network = await communityDAL.getNetworkBySlug(networkSlug);
    if (!network) {
      throw new NotFoundError("Network", networkSlug);
    }

    const communities = await communityDAL.listCommunitiesByNetwork(
      network.id,
      { activeOnly },
    );

    return NextResponse.json(communities, {
      headers: {
        // Community membership data changes rarely; allow brief caching.
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/communities");
