import { betterAuth } from "better-auth";
import type { Account, User as BetterAuthUser } from "better-auth";
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
    async signUp({
      user,
      account,
    }: {
      user: BetterAuthUser & {
        firstName: string;
        lastName: string;
        phone?: string;
        status?: string;
        bio?: string;
        profileImageUrl?: string;
        stripeCustomerId?: string;
        idVerified?: boolean;
        addressVerified?: boolean;
        emailVerified?: boolean;
        lastLoginAt?: Date;
      };
      account?: Account & {
        profile?: {
          name?: string;
          picture?: string;
        };
      };
    }) {
      console.log(
        "User signed up:",
        user.email,
        "via:",
        account?.providerId || "email",
      );

      // Set initial status based on signup method
      if (account?.providerId === "google") {
        // Google users skip email verification
        user.status = "incomplete_profile";
        user.emailVerified = true;

        // Extract profile data from Google
        if (account.profile) {
          user.profileImageUrl = account.profile.picture;

          // Parse Google name into firstName/lastName
          const fullName = account.profile.name || "";
          const nameParts = fullName.trim().split(" ");
          if (nameParts.length >= 2) {
            user.firstName = nameParts[0];
            user.lastName = nameParts.slice(1).join(" ");
          } else {
            user.firstName = nameParts[0] || "";
            user.lastName = "";
          }
        }
      } else {
        // Email signups need verification
        user.status = "pending_verification";
        user.emailVerified = false;
      }

      return user;
    },

    async signIn({
      user,
      account,
    }: {
      user: BetterAuthUser & {
        firstName: string;
        lastName: string;
        phone?: string;
        status?: string;
        bio?: string;
        profileImageUrl?: string;
        stripeCustomerId?: string;
        idVerified?: boolean;
        addressVerified?: boolean;
        lastLoginAt?: Date;
      };
      account?: Account;
    }) {
      console.log(
        "User signed in:",
        user.email,
        "via:",
        account?.providerId || "email",
      );

      // Update last login
      user.lastLoginAt = new Date();

      return user;
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
