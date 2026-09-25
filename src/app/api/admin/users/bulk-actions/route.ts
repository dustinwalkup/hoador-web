import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { userDAL, auditLogDAL } from "@/dal";
import { isSuperAdmin } from "@/features/auth/utils/guards";
import { userStatusEnum } from "@/db/schemas/_enums";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import {
  generateReEngagementEmailHtml,
  generateReEngagementEmailText,
} from "@/features/notifications/utils/email-templates";
import type { UserStatus } from "@/dal/types";

const MAX_BULK_IDS = 100;

type BulkAction = "update_status" | "send_reengagement";

interface UpdateStatusPayload {
  status: UserStatus;
}

interface ReengagementPayload {
  message: string;
  channels: { email: boolean; push: boolean };
}

/**
 * POST /api/admin/users/bulk-actions
 * Body: { action: 'update_status' | 'send_reengagement', userIds: string[], payload: UpdateStatusPayload | ReengagementPayload }
 * Requires admin authentication.
 */
async function postHandler(request: NextRequest) {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const adminUserId = authResult.userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { action, userIds, payload } = body as {
      action?: BulkAction;
      userIds?: string[];
      payload?: UpdateStatusPayload | ReengagementPayload;
    };

    if (!action || !Array.isArray(userIds) || !payload) {
      return NextResponse.json(
        { error: "action, userIds, and payload are required" },
        { status: 400 },
      );
    }

    if (userIds.length > MAX_BULK_IDS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BULK_IDS} users per request` },
        { status: 400 },
      );
    }

    if (action === "update_status") {
      const { status } = payload as UpdateStatusPayload;
      if (!status) {
        return NextResponse.json(
          { error: "payload.status is required for update_status" },
          { status: 400 },
        );
      }
      if (!(userStatusEnum.enumValues as readonly string[]).includes(status)) {
        return NextResponse.json(
          { error: "payload.status is not a valid user status" },
          { status: 400 },
        );
      }
      // Same rule as PATCH /api/admin/users/[userId] (SEC-06): only a
      // superadmin may change an admin or superadmin account.
      const callerIsSuperAdmin = await isSuperAdmin();
      const results: { userId: string; success: boolean; error?: string }[] =
        [];
      for (const userId of userIds) {
        const existingResult = await tryCatch(userDAL.getUserById(userId));
        const target = existingResult.data;
        // Fail closed: a target whose role we can't read might be privileged.
        if (!target) {
          results.push({ userId, success: false, error: "User not found" });
          continue;
        }
        if (
          !callerIsSuperAdmin &&
          (target.userType === "admin" || target.userType === "superadmin")
        ) {
          results.push({
            userId,
            success: false,
            error: "Only superadmin can modify an admin or superadmin account",
          });
          continue;
        }
        const previousStatus = target.status;
        const result = await tryCatch(
          userDAL.adminUpdateUser(userId, { status }),
        );
        const success = result.error == null;
        results.push({
          userId,
          success,
          error: result.error?.message,
        });
        if (
          success &&
          previousStatus !== undefined &&
          previousStatus !== status
        ) {
          await auditLogDAL.create({
            entityType: "user",
            entityId: userId,
            action: "admin.account_status_change",
            userId: adminUserId,
            metadata: {
              targetUserId: userId,
              previousStatus,
              newStatus: status,
            },
          });
        }
      }
      const succeeded = results.filter((r) => r.success).length;
      return NextResponse.json({
        success: true,
        action: "update_status",
        total: userIds.length,
        succeeded,
        failed: userIds.length - succeeded,
        results,
      });
    }

    if (action === "send_reengagement") {
      const { message, channels } = payload as ReengagementPayload;
      if (typeof message !== "string" || !message.trim()) {
        return NextResponse.json(
          { error: "payload.message is required for send_reengagement" },
          { status: 400 },
        );
      }
      if (
        !channels ||
        typeof channels.email !== "boolean" ||
        typeof channels.push !== "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "payload.channels { email: boolean, push: boolean } is required",
          },
          { status: 400 },
        );
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
      const dashboardUrl = `${baseUrl}/dashboard`;

      const results: { userId: string; success: boolean; error?: string }[] =
        [];
      for (const userId of userIds) {
        const { data: profile, error: fetchError } = await tryCatch(
          userDAL.getUserById(userId),
        );
        if (fetchError || !profile) {
          results.push({
            userId,
            success: false,
            error: fetchError?.message || "User not found",
          });
          continue;
        }

        const recipientName =
          profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : profile.name;

        const emailPayload =
          channels.email && profile.email
            ? {
                to: profile.email,
                subject: "We miss you on Hoador",
                html: generateReEngagementEmailHtml({
                  recipientName,
                  message: message.trim(),
                  dashboardUrl,
                  baseUrl,
                }),
                text: generateReEngagementEmailText({
                  recipientName,
                  message: message.trim(),
                  dashboardUrl,
                }),
              }
            : undefined;

        const sendResult = await tryCatch(
          sendNotification({
            userId,
            type: "re_engagement",
            title: "We miss you on Hoador",
            message: message.trim(),
            linkUrl: dashboardUrl,
            email: emailPayload,
            sendEmail: channels.email,
            sendPush: channels.push,
          }),
        );

        if (sendResult.error) {
          results.push({
            userId,
            success: false,
            error: sendResult.error.message,
          });
        } else {
          results.push({ userId, success: true });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      return NextResponse.json({
        success: true,
        action: "send_reengagement",
        total: userIds.length,
        succeeded,
        failed: userIds.length - succeeded,
        results,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use update_status or send_reengagement" },
      { status: 400 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/users/bulk-actions",
);
