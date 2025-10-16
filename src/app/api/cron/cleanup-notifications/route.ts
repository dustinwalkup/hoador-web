import { NextRequest, NextResponse } from "next/server";
import { notificationsDAL } from "@/dal";
import { tryCatch } from "@walkup/walkup-utils";

/**
 * Cron job to clean up old notifications
 * Runs daily at 2 AM UTC via Vercel Cron
 * Deletes notifications older than 90 days
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("Invalid cron secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete notifications older than 90 days
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
