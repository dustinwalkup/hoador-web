import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { notificationsDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

/**
 * Cron job to clean up old notifications.
 * Deletes notifications older than 90 days.
 * Schedule: 0 2 * * * (daily at 2 AM UTC)
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  try {
    const { data: deletedCount, error } = await tryCatch(
      notificationsDAL.deleteOldNotifications(90),
    );

    if (error) {
      console.error("Failed to delete old notifications:", error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to delete notifications",
        },
        { status: 500 },
      );
    }

    console.log(`Successfully deleted ${deletedCount} old notifications`);

    return NextResponse.json({
      success: true,
      deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/cron/cleanup-notifications",
);
