import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { joinCodeSchema } from "@/features/auth/schemas/auth-schemas";
import { AuthService } from "@/features/auth/services/auth-service";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const body = await parseFormData(request);
    const joinCode = body.joinCode as string;

    try {
      joinCodeSchema.parse({ joinCode });
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid join code format." },
        { status: 400 },
      );
    }

    const { data: result, error } = await tryCatch(
      AuthService.joinCommunity(userId, joinCode),
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
  "POST /api/auth/join-community",
);
