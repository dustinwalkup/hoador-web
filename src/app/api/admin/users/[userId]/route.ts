import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL, disputeDAL } from "@/dal";
import { isSuperAdmin } from "@/features/auth/utils/guards";
import type { UserStatus, UserType } from "@/dal/types";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * GET /api/admin/users/[userId]
 * Fetch a single user for admin detail view (profile + counts).
 * Requires admin authentication
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const { userId } = await context.params;
    const [profile, disputeResult] = await Promise.all([
      userDAL.getUserDetailsForAdmin(userId),
      disputeDAL.getUserDisputes(userId, { limit: 1 }),
    ]);
    return NextResponse.json({
      ...profile,
      totalDisputesCount: disputeResult.pagination.total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/admin/users/[userId]
 * Update user status and/or userType. Only superadmin can set userType to admin/superadmin.
 * Body: { status?: UserStatus, userType?: UserType } (at least one required)
 * Requires admin authentication
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const { userId } = await context.params;

    let body: { status?: UserStatus; userType?: UserType };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { status, userType } = body;
    if (status === undefined && userType === undefined) {
      return NextResponse.json(
        { error: "At least one of status or userType is required" },
        { status: 400 },
      );
    }

    if (
      userType !== undefined &&
      (userType === "admin" || userType === "superadmin")
    ) {
      const superAdmin = await isSuperAdmin();
      if (!superAdmin) {
        return NextResponse.json(
          { error: "Only superadmin can set admin or superadmin role" },
          { status: 403 },
        );
      }
    }

    const updates: { status?: UserStatus; userType?: UserType } = {};
    if (status !== undefined) updates.status = status;
    if (userType !== undefined) updates.userType = userType;

    const updated = await userDAL.adminUpdateUser(userId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
