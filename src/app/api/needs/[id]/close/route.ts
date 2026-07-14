import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { closeNeed } from "@/features/neighborhood-needs/services/neighborhood-needs-service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/needs/[id]/close
 * Close a need. Owner or admin; idempotent.
 */
async function postHandler(_request: NextRequest, { params }: RouteContext) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId, isAdmin } = authResult;

    const { id } = await params;

    const need = await closeNeed(id, { userId, isAdmin });
    return NextResponse.json(need);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/needs/[id]/close",
);
