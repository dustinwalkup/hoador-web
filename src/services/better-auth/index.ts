import { betterAuth } from "better-auth";
import type { User as BetterAuthUser } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db";
import { userDAL } from "@/dal";
import type { UserStatus } from "@/features/auth/schemas/signup.schema";

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
          firstName: (user as User).firstName,
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

  // Custom user fields
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
        input: true, // Can be provided during signup
      },
      lastName: {
        type: "string",
        required: true,
        input: true,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      status: {
        type: "string",
        required: false,
        input: false, // Cannot be set by user during signup
        defaultValue: "pending_verification",
      },
      bio: {
        type: "string",
        required: false,
        input: false, // Set during onboarding
      },
      profileImageUrl: {
        type: "string",
        required: false,
        input: false, // Set from Google or during onboarding
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        input: false, // Set internally
      },
      idVerified: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
      addressVerified: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  // Callbacks for custom logic
  callbacks: {
    after: {
      signUp: async (
        user: BetterAuthUser & { status?: UserStatus },
        request: { body?: { provider?: string } },
      ) => {
        console.log(
          "User signed up:",
          user.email,
          "via:",
          request.body?.provider || "email",
        );

        try {
          // Set initial status based on signup method
          if (request.body?.provider === "google") {
            // Google users skip email verification but need onboarding
            await userDAL.updateUserStatus(user.id, "incomplete_profile");
          } else {
            // Email signups need verification first
            await userDAL.updateUserStatus(user.id, "pending_verification");
          }
        } catch (error) {
          console.error("Failed to set initial user status:", error);
          // Don't throw - user can still proceed
        }
      },

      verifyEmail: async (user: BetterAuthUser) => {
        console.log("Email verified for user:", user.email);

        try {
          // Update status after email verification - user now needs onboarding
          await userDAL.updateUserStatus(user.id, "incomplete_profile");
        } catch (error) {
          console.error(
            "Failed to update status after email verification:",
            error,
          );
          // Don't throw - user can still proceed
        }
      },
    },

    before: {
      signIn: async ({ user }: { user: BetterAuthUser }) => {
        console.log("User signing in:", user.email);

        try {
          // Update last login timestamp in our database
          // Note: This method needs to be added to UserDAL
          // await userDAL.updateLastLogin(user.id);
          console.log("User signed in:", user.id);
        } catch (error) {
          console.error("Failed to update last login:", error);
          // Don't throw - user can still sign in
        }

        return user;
      },
    },
  },

  // Advanced security settings
  advanced: {
    crossSubDomainCookies: {
      enabled: false, // Set to true if using subdomains
    },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

// Export Better Auth types
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
