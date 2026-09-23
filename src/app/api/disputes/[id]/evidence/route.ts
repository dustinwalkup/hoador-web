import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { disputeDAL, rentalDAL, serviceBookingDAL } from "@/dal";
import type { DisputeRole, EvidenceType } from "@/dal/types";
import { uploadToBlob } from "@/services/vercel-blob";
import {
  processImageForUpload,
  validateImageForProcessing,
} from "@/lib/image/server";
import {
  EvidenceDeadlinePassedError,
  EvidenceLimitReachedError,
} from "@/features/disputes/lib/dispute-errors";

/** Per-participant evidence cap. Exported so a client can be told it up front. */
export const MAX_EVIDENCE_ITEMS = 10;

/**
 * POST /api/disputes/[id]/evidence
 * Upload evidence for a dispute (image or text)
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const { id: disputeId } = await params;

    // Get dispute and verify user access
    const dispute = await disputeDAL.getById(disputeId);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    let uploadedByRole: DisputeRole;

    if (dispute.serviceBookingId) {
      const detail = await serviceBookingDAL.getById(dispute.serviceBookingId);
      if (
        !detail ||
        (detail.requesterId !== userId && detail.providerId !== userId)
      ) {
        return NextResponse.json(
          { error: "You can only upload evidence for your own disputes" },
          { status: 403 },
        );
      }
      uploadedByRole = detail.requesterId === userId ? "requester" : "provider";
    } else if (dispute.rentalId) {
      const rental = await rentalDAL.getRentalDetailsById(
        dispute.rentalId,
        userId,
      );

      if (!rental) {
        return NextResponse.json(
          { error: "Rental not found" },
          { status: 404 },
        );
      }

      const isRenter = rental.renterId === userId;
      const isProvider = rental.ownerId === userId;

      if (!isRenter && !isProvider) {
        return NextResponse.json(
          { error: "You can only upload evidence for your own disputes" },
          { status: 403 },
        );
      }

      uploadedByRole = isRenter ? "renter" : "owner";
    } else {
      return NextResponse.json(
        { error: "Dispute has no linked transaction" },
        { status: 400 },
      );
    }

    // Verify dispute status allows evidence uploads
    if (
      dispute.status !== "open" &&
      dispute.status !== "evidence_requested" &&
      dispute.status !== "under_review"
    ) {
      return NextResponse.json(
        {
          error: `Evidence cannot be uploaded when dispute is in ${dispute.status} status`,
        },
        { status: 400 },
      );
    }

    // Check evidence deadline. Thrown rather than returned so it carries a
    // stable `code` — the client has to tell "you are out of time" apart from
    // "that file was not an image", and both were bare 400s (P-E13-3).
    const deadlineCheck = await disputeDAL.checkEvidenceDeadline(disputeId);
    if (deadlineCheck.expired) {
      throw new EvidenceDeadlinePassedError("Evidence deadline has expired", {
        deadline: deadlineCheck.deadline
          ? new Date(deadlineCheck.deadline).toISOString()
          : null,
      });
    }

    // Enforce per-participant evidence upload limit. The count ships with it so
    // a client can warn *before* someone picks and uploads a photo.
    const existingCount = await disputeDAL.countEvidenceByDisputeAndUser(
      disputeId,
      userId,
    );
    if (existingCount >= MAX_EVIDENCE_ITEMS) {
      throw new EvidenceLimitReachedError(
        `Maximum of ${MAX_EVIDENCE_ITEMS} evidence items per participant`,
        { limit: MAX_EVIDENCE_ITEMS, count: existingCount },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("text") as string | null;

    let evidenceType: EvidenceType;
    let content: string;

    if (file) {
      // Handle image upload
      evidenceType = "image";

      // Validate image
      const validationError = validateImageForProcessing(file);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      // Process image
      const buffer = Buffer.from(await file.arrayBuffer());

      const processedBuffer = await processImageForUpload(buffer, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 85,
        format: "jpeg",
      });

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `disputes/${disputeId}/evidence/${timestamp}-${sanitizedName.replace(/\.[^/.]+$/, ".jpg")}`;

      // Upload to Vercel Blob
      const blob = await uploadToBlob(filename, processedBuffer);
      content = blob.url;
    } else if (textContent) {
      // Handle text evidence
      evidenceType = "text";

      // Validate text content
      if (textContent.trim().length < 10) {
        return NextResponse.json(
          { error: "Text evidence must be at least 10 characters" },
          { status: 400 },
        );
      }

      if (textContent.length > 5000) {
        return NextResponse.json(
          { error: "Text evidence must be 5000 characters or less" },
          { status: 400 },
        );
      }

      content = textContent.trim();
    } else {
      return NextResponse.json(
        { error: "Either file or text content is required" },
        { status: 400 },
      );
    }

    // Create evidence record
    const evidence = await disputeDAL.createEvidence({
      disputeId,
      uploadedBy: userId,
      uploadedByRole,
      evidenceType,
      content,
    });

    // Create audit log
    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "evidence_uploaded",
      userId,
      details: {
        evidenceId: evidence.id,
        evidenceType,
      },
    });

    return NextResponse.json(evidence, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/disputes/[id]/evidence",
);
