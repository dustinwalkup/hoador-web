import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { PaymentLifecycleService } from "@/features/rentals/services/payment-lifecycle-service";

/**
 * Cron job to process payouts for completed rentals.
 * Schedule: 0 * * * * (hourly)
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  try {
    const result = await PaymentLifecycleService.processPayouts(20);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Payout processing cron error:", error);
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
  "GET /api/cron/process-payouts",
);
