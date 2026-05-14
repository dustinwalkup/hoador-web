import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { communityDAL } from "@/dal";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

/**
 * GET /api/users/me/visibility
 * Returns the current user's per-community visibility list (every community
 * in their network, visible or hidden), joined with community info.
 * Shape: Array<{ community: Community; isVisible: boolean; isPrimary: boolean }>
 * `isPrimary` flags the home community, which the UI locks as always-visible.
 * Requires authentication.
 */
async function getHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const rows = await communityDAL.getVisibilityForUser(userId);
    return NextResponse.json(
      rows.map((row) => ({
        community: row.community,
        isVisible: row.visibility.isVisible,
        isPrimary: row.isPrimary,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/users/me/visibility",
);

type VisibilityUpdate = { communityId: string; isVisible: boolean };

function parseUpdates(raw: unknown): VisibilityUpdate[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const updates: VisibilityUpdate[] = [];
  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).communityId !== "string" ||
      typeof (item as Record<string, unknown>).isVisible !== "boolean"
    ) {
      return null;
    }
    updates.push({
      communityId: (item as Record<string, unknown>).communityId as string,
      isVisible: (item as Record<string, unknown>).isVisible as boolean,
    });
  }
  return updates;
}

/**
 * PATCH /api/users/me/visibility
 * Bulk-update the current user's community visibility.
 * Body: { updates: Array<{ communityId: string; isVisible: boolean }> }
 * Returns: { updated: CommunityVisibility[] }
 * 400 if attempting to hide the primary community (mapped from ValidationError).
 * Requires authentication.
 */
async function patchHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await parseFormData(request);
    const updates = parseUpdates((body as Record<string, unknown>).updates);
    if (!updates) {
      return NextResponse.json(
        {
          error:
            "updates must be a non-empty array of { communityId, isVisible }",
        },
        { status: 400 },
      );
    }

    const updated = await communityDAL.bulkSetVisibility(userId, updates);
    return NextResponse.json({ updated });
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/users/me/visibility",
);
