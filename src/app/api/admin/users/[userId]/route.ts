import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL, disputeDAL, auditLogDAL } from "@/dal";
import { isSuperAdmin } from "@/features/auth/utils/guards";
import type { UserStatus, UserType } from "@/dal/types";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * GET /api/admin/users/[userId]
 * Fetch a single user for admin detail view (profile + counts).
 * Requires admin authentication
 */
async function getHandler(_request: NextRequest, context: RouteContext) {
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
export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/users/[userId]",
);

/**
 * PATCH /api/admin/users/[userId]
 * Update user status and/or userType. Only superadmin can set userType to admin/superadmin.
 * Body: { status?: UserStatus, userType?: UserType } (at least one required)
 * Requires admin authentication
 */
async function patchHandler(request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId: adminUserId } = authResult;

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

    const existing = await userDAL.getUserById(userId);
    const updated = await userDAL.adminUpdateUser(userId, updates);

    if (userType !== undefined && existing.userType !== userType) {
      await auditLogDAL.create({
        entityType: "user",
        entityId: userId,
        action: "admin.role_change",
        userId: adminUserId,
        metadata: {
          targetUserId: userId,
          previousRole: existing.userType,
          newRole: userType,
        },
      });
    }
    if (status !== undefined && existing.status !== status) {
      await auditLogDAL.create({
        entityType: "user",
        entityId: userId,
        action: "admin.account_status_change",
        userId: adminUserId,
        metadata: {
          targetUserId: userId,
          previousStatus: existing.status,
          newStatus: status,
        },
      });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/admin/users/[userId]",
);
