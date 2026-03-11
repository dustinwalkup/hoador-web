import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { AuthService } from "@/features/auth/services/auth-service";
import {
  handleApiError,
  parseFormData,
  getClientIP,
  getUserAgent,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";

async function postHandler(request: NextRequest) {
  try {
    const body = await parseFormData(request);
    const tosAccepted =
      body.tosAccepted === "true" || body.tosAccepted === true;
    const privacyAccepted =
      body.privacyAccepted === "true" || body.privacyAccepted === true;

    if (!tosAccepted || !privacyAccepted) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must accept the Terms of Service and Privacy Policy to continue.",
        },
        { status: 400 },
      );
    }

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId } = authResult;

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const { data: result, error } = await tryCatch(
      AuthService.acceptLegalDocuments(userId, { ipAddress, userAgent }),
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
  "POST /api/auth/accept-legal-documents",
);
