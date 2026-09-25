import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL, disputeDAL, auditLogDAL, communityDAL } from "@/dal";
import { isSuperAdmin } from "@/features/auth/utils/guards";
import { userStatusEnum, userTypeEnum } from "@/db/schemas/_enums";
import type {
  UserStatus,
  UserType,
  AdminUserPrimaryMembership,
} from "@/dal/types";

type RouteContext = { params: Promise<{ userId: string }> };

/** Validated, not cast (SEC-06): unknown values never reach the DAL. */
const adminUserPatchSchema = z
  .object({
    status: z.enum(userStatusEnum.enumValues).optional(),
    userType: z.enum(userTypeEnum.enumValues).optional(),
  })
  .refine((d) => d.status !== undefined || d.userType !== undefined, {
    message: "At least one of status or userType is required",
  });

const PRIVILEGED_USER_TYPES: readonly UserType[] = ["admin", "superadmin"];

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
    const [profile, disputeResult, communities, primaryInfo] =
      await Promise.all([
        userDAL.getUserDetailsForAdmin(userId),
        disputeDAL.getUserDisputes(userId, { limit: 1 }),
        communityDAL.listCommunitiesForUser(userId),
        communityDAL.getPrimaryMembershipForUser(userId),
      ]);

    let primaryMembership: AdminUserPrimaryMembership | null = null;
    if (primaryInfo) {
      const { membership, community } = primaryInfo;
      const network = community.networkId
        ? await communityDAL.getNetworkById(community.networkId)
        : null;
      primaryMembership = {
        community: { id: community.id, name: community.name },
        network: network
          ? { id: network.id, name: network.name, slug: network.slug }
          : null,
        role: membership.role,
        verificationStatus: membership.verificationStatus,
        verifiedAt: membership.verifiedAt,
        joinedAt: membership.createdAt,
      };
    }

    return NextResponse.json({
      ...profile,
      totalDisputesCount: disputeResult.pagination.total,
      communities,
      primaryMembership,
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
 * Update user status and/or userType. Only a superadmin can grant admin or
 * superadmin, or change anything about an account that already has either
 * (SEC-06: an admin could previously demote or suspend a superadmin).
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

    const parsed = adminUserPatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid user update request",
        },
        { status: 400 },
      );
    }
    const { status, userType } = parsed.data;

    // Gate on the target's CURRENT role as well as the requested one, so a
    // demotion or suspension of an admin is as protected as a promotion.
    const existing = await userDAL.getUserById(userId);
    if (PRIVILEGED_USER_TYPES.includes(existing.userType as UserType)) {
      const superAdmin = await isSuperAdmin();
      if (!superAdmin) {
        return NextResponse.json(
          {
            error: "Only superadmin can modify an admin or superadmin account",
          },
          { status: 403 },
        );
      }
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

/**
 * DELETE /api/admin/users/[userId]
 * Permanently delete a user. Superadmin only.
 * Requires admin authentication
 */
async function deleteHandler(_request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId: adminUserId } = authResult;

    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
      return NextResponse.json(
        { error: "Only superadmin can delete users" },
        { status: 403 },
      );
    }

    const { userId } = await context.params;

    // Chargeback auto-disputes are created by this row (migration 0070);
    // deleting it would cascade-delete every one of them (BIZ-06).
    if (userId === "system") {
      return NextResponse.json(
        { error: "The system user cannot be deleted." },
        { status: 409 },
      );
    }

    // A hard delete cascades into payment, payout and agreement records that
    // must be retained (DB-01).
    if (await userDAL.hasFinancialHistory(userId)) {
      return NextResponse.json(
        {
          error:
            "This user has payment or rental history and cannot be hard-deleted. Suspend or deactivate the account instead.",
        },
        { status: 409 },
      );
    }

    const existing = await userDAL.getUserById(userId);

    await userDAL.deleteUser(userId);

    await auditLogDAL.create({
      entityType: "user",
      entityId: userId,
      action: "admin.user_deleted",
      userId: adminUserId,
      metadata: {
        targetUserId: userId,
        targetUserEmail: existing.email,
        targetUserName: existing.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/admin/users/[userId]",
);
