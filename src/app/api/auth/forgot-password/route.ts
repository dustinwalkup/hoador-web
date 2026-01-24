import { NextRequest, NextResponse } from "next/server";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { forgotPasswordSchema } from "@/features/auth/schemas/password";
import { handleApiError, parseFormData } from "@/lib/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await parseFormData(request);
    const email = body.email as string;

    // Validate input
    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Invalid email address",
        },
        { status: 400 },
      );
    }

    const { error } = await tryCatch(
      auth.api.requestPasswordReset({
        body: {
          email: validation.data.email,
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
        },
      }),
    );

    if (error) {
      console.error("Forgot password error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send reset email. Please try again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "If an account with that email exists, we've sent you a password reset link.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
