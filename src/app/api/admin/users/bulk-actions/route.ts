import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { userDAL } from "@/dal";
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
export async function POST(request: NextRequest) {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

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
      const results: { userId: string; success: boolean; error?: string }[] =
        [];
      for (const userId of userIds) {
        const result = await tryCatch(
          userDAL.adminUpdateUser(userId, { status }),
        );
        results.push({
          userId,
          success: result.error == null,
          error: result.error?.message,
        });
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
