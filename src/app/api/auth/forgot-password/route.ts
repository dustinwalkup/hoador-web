import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import { auth } from "@/services/better-auth";
import { forgotPasswordSchema } from "@/features/auth/schemas/password";
import {
  getClientIP,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { RATE_LIMITS } from "@/constants/rate-limits";

async function postHandler(request: NextRequest) {
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

    // SEC-04: `auth.api.*` never passes through better-auth's HTTP router, so
    // its built-in limiter can't reach this path. Per email caps mail to one
    // victim; per IP caps one caller spraying many emails. The IP limit is
    // skipped when the IP is unknown — never a shared "unknown" bucket.
    const ip = getClientIP(request);
    if (ip) {
      await enforceRateLimit(
        `auth:forgot-password:ip:${ip}`,
        RATE_LIMITS.FORGOT_PASSWORD_PER_IP.limit,
        RATE_LIMITS.FORGOT_PASSWORD_PER_IP.windowSeconds,
      );
    }
    await enforceRateLimit(
      `auth:forgot-password:email:${validation.data.email.toLowerCase()}`,
      RATE_LIMITS.FORGOT_PASSWORD_PER_EMAIL.limit,
      RATE_LIMITS.FORGOT_PASSWORD_PER_EMAIL.windowSeconds,
    );

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
      const isRateLimit =
        error.message?.includes("rate limit") ||
        error.message?.includes("wait") ||
        error.message?.toLowerCase().includes("too many");
      if (isRateLimit) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Please wait before requesting another password reset email.",
          },
          { status: 429 },
        );
      }
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
export const POST = withRequestLogging(
  postHandler,
  "POST /api/auth/forgot-password",
);
