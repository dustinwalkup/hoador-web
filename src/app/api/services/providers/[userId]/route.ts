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
  blindReviewDAL,
  communityDAL,
  serviceListingDAL,
  userDAL,
} from "@/dal";
import { ForbiddenError } from "@/dal/errors";
import { patchServiceProviderSchema } from "@/features/services/lib/service-api-schemas";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";

/**
 * Symmetric per-community visibility (R5): a non-self viewer may see a
 * provider's profile only when they share at least one community where both
 * are visible. Returns the set of shared visible community IDs (used to scope
 * the listings in the response), or `null` for self (no filtering), or a 403
 * response when access is denied.
 */
async function resolveProviderProfileVisibility(
  viewerId: string,
  targetUserId: string,
): Promise<NextResponse | { sharedVisibleCommunityIds: Set<string> | null }> {
  if (viewerId === targetUserId) {
    return { sharedVisibleCommunityIds: null };
  }

  const [viewerVisible, providerVisible] = await Promise.all([
    communityDAL.getVisibleCommunityIds(viewerId),
    communityDAL.getVisibleCommunityIds(targetUserId),
  ]);
  const providerSet = new Set(providerVisible);
  const shared = new Set(viewerVisible.filter((c) => providerSet.has(c)));

  if (shared.size === 0) {
    return NextResponse.json(
      { error: "You cannot view this profile" },
      { status: 403 },
    );
  }

  return { sharedVisibleCommunityIds: shared };
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

    const visibility = await resolveProviderProfileVisibility(
      viewerId,
      targetUserId,
    );
    if (visibility instanceof NextResponse) return visibility;
    const { sharedVisibleCommunityIds } = visibility;

    const { data: profileUser, error: userError } = await tryCatch(
      userDAL.getUserById(targetUserId),
    );
    if (userError) {
      return handleApiError(userError);
    }
    if (!profileUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [
      { data: allListings, error: lErr },
      { data: aggregate, error: aggErr },
      { data: paginatedReviews, error: revErr },
    ] = await Promise.all([
      tryCatch(serviceListingDAL.findByProvider(targetUserId)),
      tryCatch(blindReviewDAL.getAggregate(targetUserId)),
      tryCatch(
        blindReviewDAL.findReleasedByReviewee(targetUserId, {
          limit: 10,
          offset: 0,
        }),
      ),
    ]);
    if (lErr) return handleApiError(lErr);
    if (aggErr) return handleApiError(aggErr);
    if (revErr) return handleApiError(revErr);

    const activeListings = (allListings ?? []).filter(
      (l) =>
        l.status === "active" &&
        (sharedVisibleCommunityIds === null ||
          sharedVisibleCommunityIds.has(l.communityId)),
    );

    return NextResponse.json({
      user: {
        id: profileUser.id,
        firstName: profileUser.firstName,
        lastName: profileUser.lastName,
        profileImageUrl: profileUser.profileImageUrl,
        createdAt: profileUser.createdAt,
      },
      // Mirrors the shape this route's own PATCH returns (`{profile: {bio}}`).
      // This was hard-coded `null`, so the provider bio — which PATCH writes and
      // the provider profile screen is required to display (mobile Req 6.2.3) —
      // was unreachable by any reader. Null bio stays null; the field is simply
      // no longer dropped.
      profile: { bio: profileUser.bio ?? null },
      activeListings,
      reviewsReceived: paginatedReviews?.data ?? [],
      aggregate: aggregate ?? { averageRating: 0, totalReviews: 0 },
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

    const { error: updateErr } = await tryCatch(
      userDAL.updateUser(targetUserId, { bio }),
    );
    if (updateErr) {
      return handleApiError(updateErr);
    }

    return NextResponse.json({ profile: { bio } });
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
