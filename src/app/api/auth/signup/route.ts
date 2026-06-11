import { NextRequest, NextResponse, after } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { emailSignupSchema } from "@/features/auth/schemas/auth-schemas";
import { AuthService } from "@/features/auth/services/auth-service";
import {
  handleApiError,
  parseFormData,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";
import { sendMetaCompleteRegistration } from "@/lib/integrations/meta/meta-capi";

async function postHandler(request: NextRequest) {
  try {
    const body = await parseFormData(request);

    const email = body.email as string;
    const password = body.password as string;
    const firstName = body.firstName as string;
    const lastName = body.lastName as string;
    const legalAccepted =
      body.legalAccepted === "true" || body.legalAccepted === true;
    const tosAccepted =
      body.tosAccepted === "true" || body.tosAccepted === true;
    const privacyAccepted =
      body.privacyAccepted === "true" || body.privacyAccepted === true;

    const legalDocumentsAccepted =
      legalAccepted || (tosAccepted && privacyAccepted);

    try {
      emailSignupSchema.parse({
        email,
        password,
        firstName,
        lastName,
        legalAccepted: legalDocumentsAccepted,
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Please check your information and try again.",
        },
        { status: 400 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const { data: result, error } = await tryCatch(
      AuthService.signUpWithEmail(
        { email, password, firstName, lastName },
        legalDocumentsAccepted,
        { ipAddress, userAgent },
      ),
    );

    if (error) {
      return handleApiError(error);
    }

    const userId = result!.userId;
    const fbp = request.cookies.get("_fbp")?.value;
    const fbc = request.cookies.get("_fbc")?.value;
    const referer = request.headers.get("referer") ?? undefined;

    // Server twin of the browser `CompleteRegistration` event. Shares
    // `event_id = userId` with the browser event for Meta dedup. Fired via
    // `after()` so Meta latency / retries never delay the signup response.
    after(async () => {
      await sendMetaCompleteRegistration({
        userId,
        method: "email",
        eventSourceUrl: referer,
        userData: {
          email,
          firstName,
          lastName,
          externalId: userId,
          ip: ipAddress ?? undefined,
          userAgent: userAgent ?? undefined,
          fbp,
          fbc,
        },
      });
    });

    return NextResponse.json({
      success: true,
      redirect: result!.redirect,
      userId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/auth/signup");
