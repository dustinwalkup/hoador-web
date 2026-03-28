import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import {
  communityDAL,
  serviceListingDAL,
  serviceReviewDAL,
  userDAL,
} from "@/dal";
import { ForbiddenError } from "@/dal/errors";
import { patchServiceProviderSchema } from "@/features/services/lib/service-api-schemas";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";

/**
 * Ensures the viewer may see the target user: self, or same HOA community.
 */
async function assertCanViewProviderProfile(
  viewerId: string,
  targetUserId: string,
): Promise<NextResponse | null> {
  if (viewerId === targetUserId) {
    return null;
  }

  const [viewerMem, targetMem] = await Promise.all([
    communityDAL.getMembershipForUser(viewerId),
    communityDAL.getMembershipForUser(targetUserId),
  ]);

  if (!viewerMem || !targetMem) {
    return NextResponse.json(
      { error: "Community membership is required to view provider profiles" },
      { status: 403 },
    );
  }

  if (viewerMem.community.id !== targetMem.community.id) {
    return NextResponse.json(
      { error: "You cannot view this profile" },
      { status: 403 },
    );
  }

  return null;
}

/**
 * GET /api/services/providers/[userId]
 * Provider profile, active listings, and recent reviews received.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const viewerId = await getCurrentUserId();
    if (!viewerId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { userId: targetUserId } = await params;

    const denied = await assertCanViewProviderProfile(viewerId, targetUserId);
    if (denied) return denied;

    const { data: profileUser, error: userError } = await tryCatch(
      userDAL.getUserById(targetUserId),
    );
    if (userError) {
      return handleApiError(userError);
    }
    if (!profileUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: providerProfile, error: pErr } = await tryCatch(
      serviceReviewDAL.getProviderProfileByUserId(targetUserId),
    );
    if (pErr) {
      return handleApiError(pErr);
    }

    const { data: allListings, error: lErr } = await tryCatch(
      serviceListingDAL.findByProvider(targetUserId),
    );
    if (lErr) {
      return handleApiError(lErr);
    }

    const activeListings = (allListings ?? []).filter(
      (l) => l.status === "active",
    );

    const { data: reviews, error: rErr } = await tryCatch(
      serviceReviewDAL.findByReviewee(targetUserId, { limit: 50 }),
    );
    if (rErr) {
      return handleApiError(rErr);
    }

    return NextResponse.json({
      user: {
        id: profileUser.id,
        firstName: profileUser.firstName,
        lastName: profileUser.lastName,
        profileImageUrl: profileUser.profileImageUrl,
        createdAt: profileUser.createdAt,
      },
      profile: providerProfile,
      activeListings,
      reviewsReceived: reviews ?? [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/services/providers/[userId]
 * Update the signed-in provider's bio (same userId only).
 */
async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const sessionUserId = await getCurrentUserId();
    if (!sessionUserId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { userId: targetUserId } = await params;
    if (sessionUserId !== targetUserId) {
      return handleApiError(
        new ForbiddenError("You can only update your own profile"),
      );
    }

    const body = await parseFormData(request);
    const parsed = patchServiceProviderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const bio = sanitizeTextWithMaxLength(parsed.data.bio.trim(), 500);

    const { data, error } = await tryCatch(
      serviceReviewDAL.upsertProviderBio(targetUserId, bio || null),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/providers/[userId]",
);
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/services/providers/[userId]",
);
