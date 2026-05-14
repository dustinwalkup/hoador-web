import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { communityDAL } from "@/dal";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  parseFormData,
  handleApiError,
} from "@/lib/api/route-helpers";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/community-memberships/[id]/verify
 * Marks a pending membership as verified. Body: { adminNotes?: string }
 * Requires admin authentication.
 */
async function postHandler(request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId: adminUserId } = authResult;

    const { id } = await context.params;

    let adminNotes: string | undefined;
    const contentType = request.headers.get("content-type") || "";
    if (contentType) {
      const body = await parseFormData(request).catch(() => ({}));
      const raw = (body as Record<string, unknown>).adminNotes;
      if (typeof raw === "string" && raw.trim().length > 0) {
        adminNotes = raw.trim();
      }
    }

    const updated = await communityDAL.verifyMembership(
      id,
      adminUserId,
      adminNotes,
    );

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/community-memberships/[id]/verify",
);
