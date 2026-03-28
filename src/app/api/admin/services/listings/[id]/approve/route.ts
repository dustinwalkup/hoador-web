import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAdminResponse,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { approveServiceListingSchema } from "@/features/services/lib/service-api-schemas";
import { ServiceListingService } from "@/features/services/services/service-listing-service";

/**
 * POST /api/admin/services/listings/[id]/approve
 * Admin approves a pending service listing.
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

    const adminId = await getCurrentUserId();
    if (!adminId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await parseFormData(request);
    const parsed = approveServiceListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { error } = await tryCatch(
      ServiceListingService.approveListing(id, adminId, parsed.data.note),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ status: "active" as const });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/services/listings/[id]/approve",
);
