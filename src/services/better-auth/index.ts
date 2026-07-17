import { betterAuth } from "better-auth";
import { NextRequest } from "next/server";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getSessionCookie as getSessionCookieFromCookies } from "better-auth/cookies";
import { db } from "@/db/db";
import { buildAuthOptions } from "./build-auth-options";

export { EMAIL_VERIFICATION_CALLBACK_URL } from "./build-auth-options";

export function getSessionCookie(request: NextRequest) {
  return getSessionCookieFromCookies(request);
}

export const auth = betterAuth(
  buildAuthOptions({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
  }),
);

// Export Better Auth types
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
