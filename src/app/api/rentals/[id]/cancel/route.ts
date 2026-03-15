import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
  parseFormData,
} from "@/lib/api/route-helpers";
import { NotFoundError, ForbiddenError, ValidationError } from "@/dal/errors";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";
import { cancelRental } from "@/features/rentals/services/cancellation-service";

const CANCEL_REASON_MAX_LENGTH = 1000;

const cancelRequestSchema = z.object({
  reason: z
    .string()
    .min(1, "Cancellation reason is required")
    .max(
      CANCEL_REASON_MAX_LENGTH,
      `Cancellation reason must be ${CANCEL_REASON_MAX_LENGTH} characters or fewer`,
    ),
});

/**
 * POST /api/rentals/[id]/cancel
 * Cancel a rental request or approved rental (thin handler — delegates to CancellationService).
 * Pending: renter only, no payment. Approved: renter or owner, with tiered refund.
 * Body: { reason: string } (required, 1–1000 chars, sanitized).
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const { id: rentalRequestId } = await params;

    const body = await parseFormData(request);
    const parseResult = cancelRequestSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error?.issues;
      const firstMessage =
        issues?.[0] && "message" in issues[0]
          ? (issues[0] as { message: string }).message
          : null;
      const message = firstMessage ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const reason = sanitizeTextWithMaxLength(
      parseResult.data.reason.trim(),
      CANCEL_REASON_MAX_LENGTH,
    );
    if (!reason) {
      return NextResponse.json(
        { error: "Cancellation reason is required" },
        { status: 400 },
      );
    }

    const { getCurrentUserId } = await import("@/features/auth/utils/session");
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const result = await tryCatch(
      cancelRental(rentalRequestId, currentUserId, {
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? undefined,
        reason,
      }),
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
  "POST /api/rentals/[id]/cancel",
);
