import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { AuthService } from "@/features/auth/services/auth-service";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

/**
 * POST /api/auth/select-community
 * Canonical post-verification step: set the user's primary community.
 * Body: { communityId: string }
 * Returns: { success: true, redirect: string }
 * Requires authentication.
 */
async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const body = await parseFormData(request);
    const communityId = body.communityId as string;

    if (typeof communityId !== "string" || communityId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "communityId is required." },
        { status: 400 },
      );
    }

    const { data: result, error } = await tryCatch(
      AuthService.selectPrimaryCommunity(userId, communityId),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({
      success: true,
      redirect: result!.redirect,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/select-community",
);
