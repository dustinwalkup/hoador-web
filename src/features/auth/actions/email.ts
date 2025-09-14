"use server";

import { tryCatch } from "@walkup/walkup-utils";
import { auth, EMAIL_VERIFICATION_CALLBACK_URL } from "@/services/better-auth";
import { UserDAL } from "@/dal/user.dal";
import { eq, and, gte } from "drizzle-orm";
import { db } from "@/db/db";
import { schema } from "@/db/schemas";

const { verification } = schema;

/**
 * Rate limiting for email resend functionality using verification table
 * Checks if user has exceeded rate limits for resending emails
 */
async function checkRateLimit(
  email: string,
): Promise<{ allowed: boolean; waitTime?: number }> {
  const now = new Date();
  const oneMinute = 60 * 1000;
  const oneHour = 60 * 60 * 1000;

  // Check recent verification attempts for this email
  const { data: recentAttempts, error } = await tryCatch(
    db.query.verification.findMany({
      where: and(
        eq(verification.identifier, email),
        gte(verification.createdAt, new Date(now.getTime() - oneHour)),
      ),
      orderBy: (verification, { desc }) => [desc(verification.createdAt)],
    }),
  );

  if (error) {
    console.error("Rate limit check error:", error);
    return { allowed: false };
  }

  if (
    !recentAttempts ||
    !Array.isArray(recentAttempts) ||
    recentAttempts.length === 0
  ) {
    return { allowed: true };
  }

  const mostRecent = recentAttempts[0];
  const timeSinceLastSent = now.getTime() - mostRecent.createdAt.getTime();

  // Check if less than 1 minute since last email
  if (timeSinceLastSent < oneMinute) {
    const waitTime = Math.ceil((oneMinute - timeSinceLastSent) / 1000);
    return {
      allowed: false,
      waitTime,
    };
  }

  // Check if more than 5 emails in the last hour
  if (recentAttempts.length >= 5) {
    const oldestInHour = recentAttempts[recentAttempts.length - 1];
    const timeUntilOldestExpires =
      oneHour - (now.getTime() - oldestInHour.createdAt.getTime());

    if (timeUntilOldestExpires > 0) {
      const waitTime = Math.ceil(timeUntilOldestExpires / 1000);
      return {
        allowed: false,
        waitTime,
      };
    }
  }

  return { allowed: true };
}

/**
 * Resend confirmation email using Better Auth
 */
async function resendConfirmationEmail(email: string, userId: string) {
  // Check rate limiting first
  const rateLimit = await checkRateLimit(email);
  if (!rateLimit.allowed) {
    throw new Error(
      rateLimit.waitTime
        ? `Please wait ${rateLimit.waitTime} seconds before requesting another email.`
        : "Too many email requests. Please try again later.",
    );
  }

  // Verify user exists and email matches
  const userDAL = new UserDAL();
  const { data: userData, error: userError } = await tryCatch(
    userDAL.getUserByEmailForAuth(email),
  );

  if (userError || !userData) {
    throw new Error("User not found");
  }

  if (userData.id !== userId) {
    throw new Error("Email and user ID do not match");
  }

  if (userData.emailVerified) {
    throw new Error("Email is already verified");
  }

  // Use Better Auth to send verification email
  const { error: authError } = await tryCatch(
    auth.api.sendVerificationEmail({
      body: {
        email,
        callbackURL: "/" + EMAIL_VERIFICATION_CALLBACK_URL,
      },
    }),
  );

  if (authError) {
    console.error("Better Auth verification email error:", authError);
    throw new Error("Failed to send verification email");
  }

  console.log(`Verification email sent successfully to: ${email}`);

  return {
    success: true,
    messageId: `msg-${Date.now()}`,
  };
}

export async function resendConfirmationEmailAction(
  prevState: unknown,
  formData: FormData,
) {
  const email = formData.get("email") as string;
  const userId = formData.get("userId") as string;

  // Validate inputs
  if (!email || !userId) {
    return {
      success: false,
      error: "Email and user ID are required",
    };
  }

  if (!email.includes("@")) {
    return {
      success: false,
      error: "Please provide a valid email address",
    };
  }

  const { data: emailResult, error } = await tryCatch(
    resendConfirmationEmail(email, userId),
  );

  if (error) {
    console.error("Resend email action error:", error);

    // Return user-friendly error messages
    let errorMessage = "Failed to resend email. Please try again later.";

    if (error.message.includes("wait")) {
      errorMessage = error.message;
    } else if (error.message.includes("already verified")) {
      errorMessage = "Your email is already verified.";
    } else if (error.message.includes("not found")) {
      errorMessage = "User account not found.";
    } else if (error.message.includes("Invalid email")) {
      errorMessage = "Please provide a valid email address.";
    }

    return {
      success: false,
      error: errorMessage,
    };
  }

  return {
    success: true,
    data: {
      message: "Confirmation email sent successfully. Please check your inbox.",
      messageId: emailResult?.messageId,
    },
  };
}
