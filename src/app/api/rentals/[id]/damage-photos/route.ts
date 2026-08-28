import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";

import { rentalDAL } from "@/dal";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import {
  processImageForUpload,
  validateImageForProcessing,
} from "@/lib/image/server";
import { uploadToBlob } from "@/services/vercel-blob";

/**
 * POST /api/rentals/[id]/damage-photos
 *
 * Upload one damage photo for a rental's return report (mobile Req 10.2.3,
 * prerequisite P-E8A-6). Returns `{ url }`; the caller collects the urls and
 * sends them to `POST /api/rentals/[id]/end`.
 *
 * ## Why one file per request
 *
 * Mirrors `POST /api/disputes/[id]/evidence`, which is the existing photo path
 * in this codebase and the one the mobile upload module (3.8) is already shaped
 * for: it uploads sequentially with per-file progress, because processing
 * several large HEICs in parallel is what OOMs older Android devices. A
 * batch endpoint would have to invent its own partial-failure semantics; this
 * way a failed photo is one retry, not a lost report.
 *
 * ## Owner-only, and only while there is a return to report on
 *
 * The renter has the dispute-evidence path for their side (Epic 13); this is the
 * owner's condition record, and it exists for `active` and `completed` rentals
 * only — a photo attached to a pending request is describing something that has
 * not happened.
 *
 * Images are re-encoded server-side as a second line of defence. The mobile
 * client already strips EXIF through its manipulator (rule #7) and the web
 * client does not, so the guarantee has to live here too.
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { id: rentalId } = await params;

    const { data: rental, error: fetchError } = await tryCatch(
      rentalDAL.getRentalRequestById(rentalId, userId),
    );
    if (fetchError || !rental) {
      return NextResponse.json({ error: "Rental not found" }, { status: 404 });
    }

    if (rental.ownerId !== userId) {
      return NextResponse.json(
        { error: "Forbidden: only the listing owner can add damage photos" },
        { status: 403 },
      );
    }

    if (rental.status !== "active" && rental.status !== "completed") {
      return NextResponse.json(
        {
          error:
            "Damage photos can only be added to an active or completed rental",
        },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validationError = validateImageForProcessing(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processImageForUpload(buffer, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 85,
      format: "jpeg",
    });

    const timestamp = Date.now();
    const safeName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/\.[^/.]+$/, ".jpg");
    const blob = await uploadToBlob(
      `rentals/${rentalId}/damage/${timestamp}-${safeName}`,
      processed,
    );

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/rentals/[id]/damage-photos",
);
