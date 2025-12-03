import { betterAuth } from "better-auth";
import { NextRequest } from "next/server";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getSessionCookie as getSessionCookieFromCookies } from "better-auth/cookies";
import { db } from "@/db/db";

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
       * There seems to be a bug in Better Auth where the callback url is not being set correctly.
       * So we need to add the EMAIL_VERIFICATION_CALLBACK_URL to the url if the callback url is /
       */
      let emailVerificationUrl = url;
      const callbackUrl = url.split("callbackURL=")[1];

      if (callbackUrl === "/") {
        // add the EMAIL_VERIFICATION_CALLBACK_URL to the url
        emailVerificationUrl = url + EMAIL_VERIFICATION_CALLBACK_URL;
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
  },

  // Social providers configuration
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirectURI: process.env.GOOGLE_CALLBACK_URL,
    },
  },
});

// Export Better Auth types
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
