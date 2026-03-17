import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { PaymentLifecycleAdminService } from "@/features/admin/services/payment-lifecycle-admin-service";
import type { LifecycleListFilters } from "@/dal/payment-lifecycle.dal";

/**
 * GET /api/admin/payments/lifecycle
 * Paginated payment lifecycle list with filters. Requires admin.
 * Query: depositHoldStatus, ownerTransferStatus, payoutStatus (comma-separated), search, page, limit
 */
async function getHandler(request: NextRequest) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const searchParams = request.nextUrl.searchParams;
    const depositHoldStatusParam = searchParams.get("depositHoldStatus");
    const ownerTransferStatusParam = searchParams.get("ownerTransferStatus");
    const payoutStatusParam = searchParams.get("payoutStatus");

    const excludeCompletedParam = searchParams.get("excludeCompleted");

    const filters: LifecycleListFilters = {
      depositHoldStatus: depositHoldStatusParam
        ? (depositHoldStatusParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean) as LifecycleListFilters["depositHoldStatus"])
        : undefined,
      ownerTransferStatus: ownerTransferStatusParam
        ? (ownerTransferStatusParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean) as LifecycleListFilters["ownerTransferStatus"])
        : undefined,
      payoutStatus: payoutStatusParam
        ? (payoutStatusParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean) as LifecycleListFilters["payoutStatus"])
        : undefined,
      search: searchParams.get("search") ?? undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
      excludeCompleted:
        excludeCompletedParam !== null
          ? excludeCompletedParam !== "false"
          : undefined,
    };

    const result = await PaymentLifecycleAdminService.getLifecycleList(filters);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/payments/lifecycle",
);
