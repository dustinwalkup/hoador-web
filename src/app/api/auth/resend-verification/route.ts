import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { handleApiError, parseFormData } from "@/lib/api/route-helpers";

async function postHandler(request: NextRequest) {
  try {
    const body = await parseFormData(request);
    const email = body.email as string;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email address is required." },
        { status: 400 },
      );
    }

    // Use Better Auth to resend verification email
    const { error } = await tryCatch(
      auth.api.sendVerificationEmail({
        body: {
          email,
          callbackURL: "/signup/email/callback",
        },
      }),
    );

    if (error) {
      console.error("Resend verification email error:", error);

      if (error.message?.includes("already verified")) {
        return NextResponse.json(
          { success: false, error: "This email address is already verified." },
          { status: 400 },
        );
      }

      if (error.message?.includes("not found")) {
        return NextResponse.json(
          {
            success: false,
            error: "No account found with this email address.",
          },
          { status: 404 },
        );
      }

      if (
        error.message?.includes("rate limit") ||
        error.message?.includes("wait")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Please wait before requesting another verification email.",
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to send verification email. Please try again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent! Please check your inbox.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/resend-verification",
);
