import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  captureNonCriticalError,
  parseFormData,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";
import { disputeDAL, rentalDAL, legalDocumentDAL, auditLogDAL } from "@/dal";
import { z } from "zod";
import type {
  DisputeStatus,
  DisputeReasonCode,
  DisputeRole,
} from "@/dal/types";
import { sendDisputeNotifications } from "@/features/disputes/notifications/dispute-notifications";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";
import { db } from "@/db/db";
import { rentals } from "@/db/schemas/rentals.schema";
import { eq } from "drizzle-orm";

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
const createDisputeSchema = z.object({
  rentalId: z.string().uuid("Invalid rental ID"),
  reasonCode: z.enum([
    "damage",
    "non_delivery",
    "quality_issue",
    "cancellation",
    "payment_issue",
    "other",
  ]),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

async function postHandler(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    // Parse and validate request body
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

    const { rentalId, reasonCode, description } = validationResult.data;

    // Get rental to verify user access and determine role
    const rental = await rentalDAL.getRentalDetailsById(rentalId, userId);

    if (!rental) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    // Resolve actual rental ID if this is a rental request
    let actualRentalId = rentalId;
    if (rental.type === "request") {
      // Find the actual rental record from the rentals table
      const actualRental = await db.query.rentals.findFirst({
        where: eq(rentals.requestId, rental.id),
        columns: { id: true },
      });

      if (!actualRental) {
        return NextResponse.json(
          {
            error:
              "Cannot create dispute for a rental request that hasn't been approved. Disputes can only be created for active rentals.",
          },
          { status: 400 },
        );
      }

      actualRentalId = actualRental.id;
    }

    // Check for existing active dispute using actual rental ID
    const existingDispute =
      await disputeDAL.getActiveByRentalId(actualRentalId);
    if (existingDispute) {
      return NextResponse.json(
        { error: "An active dispute already exists for this rental" },
        { status: 409 },
      );
    }

    // Verify user is renter or provider
    const isRenter = rental.renterId === userId;
    const isProvider = rental.ownerId === userId;

    if (!isRenter && !isProvider) {
      return NextResponse.json(
        { error: "You can only create disputes for your own rentals" },
        { status: 403 },
      );
    }

    // Determine role
    const createdByRole: DisputeRole = isRenter ? "renter" : "provider";

    // Check rate limits
    const rateLimitCheck = await disputeDAL.checkRateLimits(userId);
    if (!rateLimitCheck.withinLimits) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          details: {
            monthlyCount: rateLimitCheck.monthlyCount,
            yearlyCount: rateLimitCheck.yearlyCount,
            limit: { monthly: 3, yearly: 10 },
          },
        },
        { status: 429 },
      );
    }

    // Validate time window using actual rental ID
    const timeWindowCheck = await disputeDAL.validateTimeWindow(
      actualRentalId,
      reasonCode,
    );
    if (!timeWindowCheck.valid) {
      return NextResponse.json(
        { error: timeWindowCheck.message || "Time window expired" },
        { status: 400 },
      );
    }

    // Get policy version from database
    const disputePolicy = await legalDocumentDAL.getCurrentVersion(
      LEGAL_DOCUMENT_IDS.DISPUTE_POLICY,
    );
    const policyVersion = disputePolicy?.version || "v1.0";

    // Create dispute using actual rental ID
    const dispute = await disputeDAL.create({
      rentalId: actualRentalId,
      createdBy: userId,
      createdByRole,
      reasonCode,
      description,
      policyVersion,
    });

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);
    await auditLogDAL.create({
      entityType: "dispute",
      entityId: dispute.id,
      action: "dispute.opened",
      userId,
      metadata: { reasonCode, createdByRole },
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });

    // Create audit log for dispute creation
    await disputeDAL.createAuditLog({
      disputeId: dispute.id,
      actionType: "dispute_created",
      userId,
      details: {
        reasonCode,
        createdByRole,
      },
    });

    // Send notifications (don't block on notification failure)
    try {
      await sendDisputeNotifications(dispute, "created");
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/disputes",
        action: "send_dispute_created_notifications",
      });
    }

    return NextResponse.json(dispute, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/disputes");
