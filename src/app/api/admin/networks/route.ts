import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { communityDAL } from "@/dal";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";

/**
 * GET /api/admin/networks
 * Lists all community networks. Used to populate the network dropdown in the
 * admin community editor (no dedicated networks-management UI — AD#12).
 * Requires admin authentication.
 */
async function getHandler() {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const networks = await communityDAL.listNetworks();
    return NextResponse.json(networks);
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/admin/networks");
