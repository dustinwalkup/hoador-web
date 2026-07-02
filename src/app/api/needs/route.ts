import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { getCurrentUserVisibleCommunityIds } from "@/features/community/utils/membership";
import { neighborhoodNeedsDAL } from "@/dal";
import type { NeedFeedFilters } from "@/dal/neighborhood-needs.dal";
import { createNeed } from "@/features/neighborhood-needs/services/neighborhood-needs-service";
import { emptyPaginatedResult } from "@/lib/api/pagination";

const createNeedSchema = z.object({
  type: z.enum(["rental", "service"]),
  categoryId: z.string().uuid("categoryId must be a valid UUID"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or fewer"),
  description: z.string().min(1, "Description is required"),
  neededStartDate: z.string().date().nullable().optional(),
  neededEndDate: z.string().date().nullable().optional(),
});

/**
 * POST /api/needs
 * Create a new Neighborhood Need.
 */
async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createNeedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const need = await createNeed(userId, parsed.data);
    return NextResponse.json(need, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/needs
 * Return the network-scoped Neighborhood Needs feed for the authenticated viewer.
 * Query params: type, categoryId, openOnly (default true), page, limit
 */
async function getHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20),
    );

    const visibleCommunityIds = await getCurrentUserVisibleCommunityIds();

    if (visibleCommunityIds.length === 0) {
      return NextResponse.json(emptyPaginatedResult(page, limit));
    }

    const rawType = sp.get("type");
    const filters: NeedFeedFilters = {
      type:
        rawType === "rental"
          ? "rental"
          : rawType === "service"
            ? "service"
            : undefined,
      categoryId: sp.get("categoryId") ?? undefined,
      openOnly: sp.get("openOnly") !== "false",
    };

    const viewerLocation =
      await neighborhoodNeedsDAL.getUserPrimaryLocation(userId);

    const result = await neighborhoodNeedsDAL.listFeed(
      visibleCommunityIds,
      filters,
      { page, limit },
      viewerLocation,
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(postHandler, "POST /api/needs");
export const GET = withRequestLogging(getHandler, "GET /api/needs");
