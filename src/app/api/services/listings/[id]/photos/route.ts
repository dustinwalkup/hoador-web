import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getClientIP,
  getCurrentUserId,
  getUserAgent,
  handleApiError,
  requireAuthResponse,
} from "@/lib/api/route-helpers";
import { ServiceListingService } from "@/features/services/services/service-listing-service";
import { MAX_SERVICE_PHOTOS } from "@/constants/services";

/**
 * Service listing photos (mobile Req 11.3.1, P-E10-4).
 *
 * **This surface did not exist.** `service_listings.photos` has been in the
 * schema since it was written, but no route reads or writes it and neither the
 * create nor the patch body schema mentions it (mobile F17/Epic 9 F19) — so a
 * provider has never been able to put a photo on a service listing from any
 * client.
 *
 * Two verbs, because the column is a URL array rather than rows:
 *   POST — add one photo (multipart, field `file`)
 *   PUT  — replace the array; this is BOTH reorder and remove, since order is
 *          the array order and identity is the URL
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F17 / P-E10-4
 */

const setPhotosSchema = z.object({
  photos: z
    .array(z.string().url("Each photo must be a URL"))
    .max(MAX_SERVICE_PHOTOS, `At most ${MAX_SERVICE_PHOTOS} photos`),
});

async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const { data, error } = await tryCatch(
      ServiceListingService.addPhoto(id, userId, file, {
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      }),
    );
    if (error) return handleApiError(error);

    return NextResponse.json({ success: true, photos: data.photos ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

async function putHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const parsed = setPhotosSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // The subset check that makes this safe lives in the service — a URL the
    // listing does not already own is refused there, so this endpoint cannot be
    // used to inject an arbitrary image into another member's feed.
    const { data, error } = await tryCatch(
      ServiceListingService.setPhotos(id, userId, parsed.data.photos, {
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      }),
    );
    if (error) return handleApiError(error);

    return NextResponse.json({ success: true, photos: data.photos ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/listings/[id]/photos",
);
export const PUT = withRequestLogging(
  putHandler,
  "PUT /api/services/listings/[id]/photos",
);
