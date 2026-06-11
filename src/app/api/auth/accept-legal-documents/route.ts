import { NextRequest, NextResponse, after } from "next/server";
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
import { userDAL } from "@/dal";
import { sendMetaCompleteRegistration } from "@/lib/integrations/meta/meta-capi";

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

    // Fire server CAPI CompleteRegistration only on the Google new-signup
    // transition (pending_verification → email_verified). Existing users
    // re-accepting updated legal docs do not trigger it. Same `event_id =
    // userId` as the browser side so Meta dedupes the pair.
    if (result!.isNewSignup) {
      const fbp = request.cookies.get("_fbp")?.value;
      const fbc = request.cookies.get("_fbc")?.value;
      const referer = request.headers.get("referer") ?? undefined;
      after(async () => {
        const { data: profile } = await tryCatch(userDAL.getUserById(userId));
        await sendMetaCompleteRegistration({
          userId,
          method: "google",
          eventSourceUrl: referer,
          userData: {
            email: profile?.email,
            firstName: profile?.firstName ?? undefined,
            lastName: profile?.lastName ?? undefined,
            externalId: userId,
            ip: ipAddress ?? undefined,
            userAgent: userAgent ?? undefined,
            fbp,
            fbc,
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      redirect: result!.redirect,
      isNewSignup: result!.isNewSignup,
      userId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/accept-legal-documents",
);
