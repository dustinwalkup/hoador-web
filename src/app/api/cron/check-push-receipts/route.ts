import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { checkExpoPushReceipts } from "@/features/notifications/lib/expo-push-service";
import { tryCatch } from "@walkup/walkup-utils";

/**
 * Resolve outstanding Expo push receipts and deactivate dead device tokens.
 *
 * Schedule: hourly (`0 * * * *`). Expo publishes receipts ~15 minutes after a
 * send and retains them roughly a day, so hourly is the only cadence that fits
 * — daily would risk the whole window closing between runs.
 *
 * This is the native counterpart to web push's inline 410/404 pruning: Expo
 * accepts a send synchronously (the ticket) and only reports what APNs/FCM
 * actually did later (the receipt), so pruning cannot happen at send time alone.
 *
 * Requirements: 2.2.4
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.2.2
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  try {
    const { data: result, error } = await tryCatch(checkExpoPushReceipts());

    if (error) {
      console.error("Failed to check push receipts:", error);
      return NextResponse.json(
        { success: false, error: error.message || "Failed to check receipts" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
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
  "GET /api/cron/check-push-receipts",
);
