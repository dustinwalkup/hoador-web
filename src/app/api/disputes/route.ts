import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";
import { disputeDAL } from "@/dal";
import type {
  DisputeStatus,
  DisputeReasonCode,
  DisputeRole,
} from "@/dal/types";
import { DisputeCreationService } from "@/features/disputes/services/dispute-creation-service";

/**
 * GET /api/disputes
 * Get list of disputes
 * - Admins: Get all disputes with filters
 * - Users: Get their own disputes (as renter or provider)
 */
async function getHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId, isAdmin } = authResult;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const status = searchParams.get("status") as DisputeStatus | null;
    const role = searchParams.get("role") as DisputeRole | null;
    const reasonCode = searchParams.get(
      "reasonCode",
    ) as DisputeReasonCode | null;

    if (isAdmin) {
      // Admin: Get all disputes with filters
      const disputes = await disputeDAL.getAdminDisputes({
        status: status || undefined,
        reasonCode: reasonCode || undefined,
        page,
        limit,
      });

      return NextResponse.json(disputes);
    } else {
      // User: Get their own disputes
      const disputes = await disputeDAL.getUserDisputes(userId, {
        role: role || undefined,
        status: status || undefined,
        page,
        limit,
      });

      return NextResponse.json(disputes);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(getHandler, "GET /api/disputes");

/**
 * POST /api/disputes
 * Create a new dispute
 */
const disputeReasonCodes = [
  "damage",
  "non_delivery",
  "quality_issue",
  "cancellation",
  "payment_issue",
  "renter_no_show",
  "owner_no_show",
  "requester_no_show",
  "provider_no_show",
  "other",
] as const;

const createDisputeSchema = z
  .object({
    rentalId: z.string().uuid("Invalid rental ID").optional(),
    serviceBookingId: z.string().uuid("Invalid service booking ID").optional(),
    reasonCode: z.enum(disputeReasonCodes),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters"),
  })
  .refine((data) => Boolean(data.rentalId) !== Boolean(data.serviceBookingId), {
    message: "Provide exactly one of rentalId or serviceBookingId",
    path: ["rentalId"],
  });

async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await parseFormData(request);
    const validationResult = createDisputeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { rentalId, serviceBookingId, reasonCode, description } =
      validationResult.data;

    const { dispute } = await DisputeCreationService.createDispute({
      rentalId,
      serviceBookingId,
      reasonCode,
      description,
      userId,
      ipAddress: getClientIP(request) ?? undefined,
      userAgent: getUserAgent(request) ?? undefined,
    });

    return NextResponse.json(dispute, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/disputes");
