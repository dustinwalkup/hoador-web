import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db"; // your drizzle instance
import {
  users,
  session,
  account,
  verification,
} from "@/db/schemas/users.schema";

// Debug: Check if Google credentials are available
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log("🔍 Auth config debug:");
console.log("Google Client ID available:", !!googleClientId);
console.log("Google Client Secret available:", !!googleClientSecret);

// Build social providers config conditionally
const socialProviders: Record<
  string,
  { clientId: string; clientSecret: string }
> = {};

if (googleClientId && googleClientSecret) {
  socialProviders.google = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  };
  console.log("✅ Google provider added to config");
} else {
  console.log("❌ Google provider NOT added - missing credentials");
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
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
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
