import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { PaymentLifecycleAdminService } from "@/features/admin/services/payment-lifecycle-admin-service";

/**
 * GET /api/admin/payments/metrics
 * Financial KPIs and aggregate payment metrics. Requires admin.
 * Query: days (7, 30, 90 — defaults to 30)
 */
async function getHandler(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const days = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);
    const result = await PaymentLifecycleAdminService.getFinancialMetrics(days);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/payments/metrics",
);
