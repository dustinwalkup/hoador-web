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
 * POST /api/admin/community-memberships/[id]/deny
 * Denies a pending membership. Body: { adminNotes: string } (required).
 * 400 if adminNotes is missing/empty (mapped from ValidationError).
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

    const body = await parseFormData(request).catch(() => ({}));
    const rawNotes = (body as Record<string, unknown>).adminNotes;
    const adminNotes = typeof rawNotes === "string" ? rawNotes : "";

    // DAL enforces the non-empty requirement, but reject early for a clearer
    // 400 without touching the DB.
    if (adminNotes.trim().length === 0) {
      return NextResponse.json(
        { error: "adminNotes is required when denying a membership." },
        { status: 400 },
      );
    }

    const updated = await communityDAL.denyMembership(
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
  "POST /api/admin/community-memberships/[id]/deny",
);
