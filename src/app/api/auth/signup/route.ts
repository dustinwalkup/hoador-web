import { NextRequest, NextResponse } from "next/server";
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

    return NextResponse.json({
      success: true,
      redirect: result!.redirect,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/auth/signup");
