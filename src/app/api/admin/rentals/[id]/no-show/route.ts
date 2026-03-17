import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { NotFoundError, ForbiddenError, ValidationError } from "@/dal/errors";
import { applyNoShow } from "@/features/rentals/services/cancellation-service";

const noShowSchema = z.object({
  type: z.enum(["renter_no_show", "owner_no_show"]),
});

/**
 * POST /api/admin/rentals/[id]/no-show
 * Apply a no-show outcome (ops-triggered). Requires admin.
 * Body: { type: "renter_no_show" | "owner_no_show" }
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

    const { id: rentalRequestId } = await params;

    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const opsUserId = await getCurrentUserId();
    if (!opsUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = noShowSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid data",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await tryCatch(
      applyNoShow(rentalRequestId, parseResult.data.type, opsUserId),
    );

    if (result.error) {
      if (result.error instanceof NotFoundError) {
        return NextResponse.json(
          { error: result.error.message || "Rental not found" },
          { status: 404 },
        );
      }
      if (result.error instanceof ForbiddenError) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 403 },
        );
      }
      if (result.error instanceof ValidationError) {
        return NextResponse.json(
          { error: result.error.message },
          { status: 400 },
        );
      }
      return handleApiError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/rentals/[id]/no-show",
);
