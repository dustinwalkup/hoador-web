import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  // Email verification configuration
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      // Import Resend service
      const { sendVerificationEmail } = await import("@/services/resend");

      try {
        await sendVerificationEmail({
          to: user.email,
          verificationUrl: url,
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
      scope: ["openid", "email", "profile"], // Request profile data
    },
  },
});

// Export Better Auth types
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
