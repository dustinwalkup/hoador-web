import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { resetPasswordSchema } from "@/features/auth/schemas/password";
import { handleApiError, parseFormData } from "@/lib/api/route-helpers";

async function postHandler(request: NextRequest) {
  try {
    const body = await parseFormData(request);
    const token = body.token as string;
    const password = body.password as string;

    // Validate input
    const validation = resetPasswordSchema.safeParse({ token, password });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid input",
        },
        { status: 400 },
      );
    }

    const { error } = await tryCatch(
      auth.api.resetPassword({
        body: {
          token: validation.data.token,
          newPassword: validation.data.password,
        },
      }),
    );

    if (error) {
      console.error("Reset password error:", error);

      // Handle specific error cases
      if (
        error.message?.includes("expired") ||
        error.message?.includes("invalid")
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This reset link has expired or is invalid. Please request a new one.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to reset password. Please try again.",
        },
        { status: 500 },
      );
    }

    // Success! Return redirect URL
    return NextResponse.json({
      success: true,
      redirect: "/login?message=password-reset-success",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/reset-password",
);
