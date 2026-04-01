import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { servicePaymentLifecycleDAL } from "@/dal";

/**
 * GET /api/admin/services/payment-metrics
 * Aggregate service payment lifecycle metrics and financial KPIs. Requires admin.
 * Query: days (default 30) for financial window.
 */
async function getHandler(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const days = parseInt(request.nextUrl.searchParams.get("days") || "30", 10);

    const [paymentMetrics, financialMetrics] = await Promise.all([
      servicePaymentLifecycleDAL.getPaymentMetrics(),
      servicePaymentLifecycleDAL.getFinancialMetrics(days),
    ]);

    return NextResponse.json({ paymentMetrics, financialMetrics, days });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/services/payment-metrics",
);
