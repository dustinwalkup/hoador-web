import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  requireAdminResponse,
} from "@/lib/api/route-helpers";
import { communityDAL, neighborhoodNeedsDAL } from "@/dal";
import {
  updateNeed,
  deleteNeed,
} from "@/features/neighborhood-needs/services/neighborhood-needs-service";

const updateNeedSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  neededStartDate: z.string().date().nullable().optional(),
  neededEndDate: z.string().date().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/needs/[id]
 * Return need detail. Creator and admins can always view; others need network visibility.
 */
async function getHandler(_request: NextRequest, { params }: RouteContext) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId, isAdmin } = authResult;

    const { id } = await params;

    const detail = await neighborhoodNeedsDAL.getNeedDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isAdmin && detail.createdByUserId !== userId) {
      const visibleIds = await communityDAL.getVisibleCommunityIds(userId);
      if (!visibleIds.includes(detail.communityId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/needs/[id]
 * Edit a need. Owner or admin only.
 */
async function patchHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId, isAdmin } = authResult;

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateNeedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await updateNeed(id, parsed.data, { userId, isAdmin });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/needs/[id]
 * Admin-only soft delete.
 */
async function deleteHandler(_request: NextRequest, { params }: RouteContext) {
  try {
    const adminError = await requireAdminResponse();
    if (adminError) return adminError;

    const { id } = await params;

    await deleteNeed(id, { isAdmin: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/needs/[id]");
export const PATCH = withRequestLogging(patchHandler, "PATCH /api/needs/[id]");
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/needs/[id]",
);
