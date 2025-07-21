import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db"; // your drizzle instance
import {
  users,
  session,
  account,
  verification,
} from "@/db/schemas/users.schema";

// Build social providers config conditionally
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const socialProviders: Record<
  string,
  { clientId: string; clientSecret: string }
> = {};

if (googleClientId && googleClientSecret) {
  socialProviders.google = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  };
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: session,
      account: account,
      verification: verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true when you implement email sending
  },
  ...(Object.keys(socialProviders).length > 0 && { socialProviders }),
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false, // Make this optional for Google OAuth
      },
      lastName: {
        type: "string",
        required: false, // Make this optional for Google OAuth
      },
      phone: {
        type: "string",
        required: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "pending_verification",
      },
      phoneVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      idVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      addressVerified: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      twoFactorEnabled: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      twoFactorSecret: {
        type: "string",
        required: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
      },
    },
  },
});
