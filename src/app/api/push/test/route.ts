import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getCurrentUserId,
  requireAuthResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { buildPushPayload } from "@/features/notifications/lib/push-payload";
import { sendPush } from "@/features/notifications/lib/push-service";
import { pushSubscriptionDAL } from "@/dal";

/**
 * POST /api/push/test
 * Send a test push notification to the authenticated user's active subscriptions.
 */
async function postHandler(): Promise<NextResponse> {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const subscriptions = await pushSubscriptionDAL.getActiveByUserId(userId);
    if (!subscriptions?.length) {
      return NextResponse.json(
        { sent: false, error: "No active push subscriptions" },
        { status: 200 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
    const payload = buildPushPayload(
      "Test notification",
      "This is a test push from Hoador. If you see this, push is working.",
      `${baseUrl}/dashboard`,
      "system",
    );

    sendPush(userId, payload);

    return NextResponse.json({
      sent: true,
      message: "Test notification sent to your device(s)",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/push/test");
