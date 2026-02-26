import { betterAuth } from "better-auth";
import { NextRequest } from "next/server";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { getSessionCookie as getSessionCookieFromCookies } from "better-auth/cookies";
import { db } from "@/db/db";
import { trackActivity } from "@/features/activity/lib/track-activity";

export const EMAIL_VERIFICATION_CALLBACK_URL = "signup/email/callback";

export function getSessionCookie(request: NextRequest) {
  return getSessionCookieFromCookies(request);
}

export const auth = betterAuth({
  // Database adapter
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Trusted origins
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],

  // Base URL
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      // Import Resend service
      const { sendResetPasswordEmail } =
        await import("@/services/resend/send-reset-password-email");

      try {
        await sendResetPasswordEmail({
          to: user.email,
          callbackUrl: url,
        });
      } catch (error) {
        console.error("Failed to send reset password email:", error);
        throw new Error("Failed to send reset password email");
      }
    },
    onPasswordReset: async ({ user }) => {
      // logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },

  // Enable account linking for Google → email/password sync
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      updateUserInfoOnLink: true,
    },
  },

  // Email verification configuration
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      // Import Resend service
      const { sendVerificationEmail } =
        await import("@/services/resend/send-verification-email");
      /**
       * Better Auth sometimes sends callbackURL=/ (or encoded %2F). Redirect to our
       * email callback page so the user lands on /signup/email/callback after verification.
       */
      let emailVerificationUrl = url;
      try {
        const parsed = new URL(url);
        const callbackParam = parsed.searchParams.get("callbackURL") ?? "";
        const isRootCallback = callbackParam === "" || callbackParam === "/";
        if (isRootCallback) {
          parsed.searchParams.set(
            "callbackURL",
            `/${EMAIL_VERIFICATION_CALLBACK_URL}`,
          );
          emailVerificationUrl = parsed.toString();
        }
      } catch {
        // If URL parsing fails, use original url
      }

      try {
        await sendVerificationEmail({
          to: user.email,
          // adding the callback url to the url
          verificationUrl: emailVerificationUrl,
          firstName: (user as User).name,
        });
        console.log("Verification email sent to:", user.email);
      } catch (error) {
        console.error("Failed to send verification email:", error);
        // Don't throw - let user retry verification
      }
    },
    async afterEmailVerification(user) {
      // Set app status so middleware routes to /join-code
      const { userDAL } = await import("@/dal");
      await userDAL.updateUserStatus(user.id, "email_verified");
    },
  },

  // Social providers configuration
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirectURI: process.env.GOOGLE_CALLBACK_URL,
    },
  },

  // Track login activity for admin inactivity filtering
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context?.newSession as
        | {
            user: { id: string };
            session?: { ipAddress?: string; userAgent?: string };
          }
        | undefined;
      if (!newSession?.user?.id) return;

      const isSignIn =
        ctx.path?.includes("sign-in") || ctx.path?.includes("callback");
      if (!isSignIn) return;

      const ipAddress =
        ctx.request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        ctx.request?.headers?.get("x-real-ip") ??
        null;
      const userAgent = ctx.request?.headers?.get("user-agent") ?? null;

      trackActivity(
        newSession.user.id,
        "login",
        undefined,
        ipAddress,
        userAgent,
      );
    }),
  },
});

// Export Better Auth types
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
