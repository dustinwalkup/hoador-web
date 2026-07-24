import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { expo } from "@better-auth/expo";
import type { BetterAuthOptions } from "better-auth";
import { trackActivity } from "@/features/activity/lib/track-activity";
import { MOBILE_APP_SCHEME } from "@/constants/mobile";
import { generateAppleClientSecret } from "./apple-client-secret";
import { e2eGoogleCallbackPlugin } from "./e2e-google-plugin";

export const EMAIL_VERIFICATION_CALLBACK_URL = "signup/email/callback";

// `MOBILE_APP_SCHEME` (the app's custom URL scheme, registered in
// `trustedOrigins` so the Expo plugin's OAuth callbacks and reset deep links
// resolve into the app) now lives in `@/constants/mobile` — shared with the
// Stripe Connect bounce pages rather than re-declared here.
// Spec: epic-01-backend-auth.md (D-E1-3), epic-02-backend-services.md (D-E2-6).

/**
 * Expo dev-client origins. Only trusted in development — a released build must
 * never accept `exp://`, which any local machine can serve.
 */
const EXPO_DEV_ORIGINS = ["exp://", "exp://**", "exp://192.168.*.*:*/**"];

/** Apple's authorization server; required in trustedOrigins for Sign in with Apple. */
const APPLE_AUTH_ORIGIN = "https://appleid.apple.com";

/**
 * A PKCS#8 PEM, after `\n`-unescaping, is delimited by these markers — the exact
 * shape `importPKCS8` requires. A key pasted without them (the Vercel env
 * footgun: lost BEGIN/END lines, stray wrapping quotes, newlines collapsed to
 * spaces) is the common real-world failure, and it is cheap to detect here.
 */
function hasPkcs8Shape(rawPrivateKey: string): boolean {
  const pem = rawPrivateKey.replace(/\\n/g, "\n").trim();
  return (
    pem.startsWith("-----BEGIN PRIVATE KEY-----") &&
    pem.endsWith("-----END PRIVATE KEY-----")
  );
}

/**
 * Apple is configured only where its credentials exist AND the private key is a
 * well-formed PKCS#8 PEM. Sign in with Apple needs a Services ID, Team ID, Key ID
 * and the .p8 private key (see the epic file's prerequisite P1).
 *
 * Two failure modes are folded in here so a bad config degrades to "Apple off"
 * rather than taking down all auth:
 *  - Partial config → a half-registered provider fails at request time with an
 *    opaque Apple error; absence is easier to diagnose.
 *  - Malformed private key → the provider factory's `importPKCS8` throws, and
 *    because better-auth builds every social provider up front, that one throw
 *    500s EVERY auth request (login, signup, reset). Skipping the provider keeps
 *    the rest of auth alive and logs the reason loudly.
 */
function isAppleConfigured(): boolean {
  const hasAllCredentials = Boolean(
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY,
  );
  if (!hasAllCredentials) return false;

  if (!hasPkcs8Shape(process.env.APPLE_PRIVATE_KEY!)) {
    console.error(
      "[auth] APPLE_PRIVATE_KEY is set but is not a PKCS#8 PEM (missing " +
        "-----BEGIN/END PRIVATE KEY----- markers). Sign in with Apple is " +
        "disabled; email, Google, and password reset are unaffected.",
    );
    return false;
  }
  return true;
}

type AuthDependencies = {
  /** Injected so tests can build the real config against an in-memory adapter. */
  database: BetterAuthOptions["database"];
};

/**
 * The Better Auth configuration, with the database adapter injected.
 *
 * Split out of `index.ts` so the *real* configuration — plugins, trustedOrigins,
 * cookie behavior — can be exercised in tests without a live Postgres
 * connection (`index.ts` builds a drizzle adapter at module load, which made the
 * config untestable and therefore untested). See `__tests__/`.
 */
export function buildAuthOptions({ database }: AuthDependencies) {
  return {
    database,

    // Trusted origins: the web app, the mobile scheme (Req 2.1.3), and Apple's
    // authorization server (required for Sign in with Apple, Req 2.4.1).
    trustedOrigins: [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      `${MOBILE_APP_SCHEME}://`,
      `${MOBILE_APP_SCHEME}://*`,
      APPLE_AUTH_ORIGIN,
      ...(process.env.NODE_ENV === "development" ? EXPO_DEV_ORIGINS : []),
    ],

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
        if (process.env.E2E_TEST === "1") {
          const { captureEmail } = await import("@/test/e2e/email-capture");
          captureEmail("reset", url);
          return;
        }
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

    // Enable account linking for Google/Apple → email/password sync (Req 2.4.1)
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple"],
        updateUserInfoOnLink: true,
      },
    },

    // Email verification configuration
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24, // 24 hours
      sendVerificationEmail: async ({ user, url }) => {
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

        if (process.env.E2E_TEST === "1") {
          const { captureEmail } = await import("@/test/e2e/email-capture");
          captureEmail("verification", emailVerificationUrl);
          return;
        }
        const { sendVerificationEmail } =
          await import("@/services/resend/send-verification-email");

        try {
          await sendVerificationEmail({
            to: user.email,
            // adding the callback url to the url
            verificationUrl: emailVerificationUrl,
            firstName: user.name,
          });
          console.log("Verification email sent to:", user.email);
        } catch (error) {
          console.error("Failed to send verification email:", error);
          // Don't throw - let user retry verification
        }
      },
      async afterEmailVerification(user) {
        // Only advance status if still pending - avoid regressing users
        // who already progressed past email verification
        const { userDAL } = await import("@/dal");
        const userProfile = await userDAL.getUserById(user.id);
        if (userProfile.status === "pending_verification") {
          await userDAL.updateUserStatus(user.id, "email_verified");
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

      /**
       * Sign in with Apple (Req 2.4). Declared as an async factory because the
       * client secret is a JWT minted per cold start — see `apple-client-secret.ts`.
       *
       * `appBundleIdentifier` is what makes the native idToken flow validate:
       * the app authenticates with the App ID, while web OAuth uses the Services
       * ID, so Apple's `aud` claim differs between them and better-auth needs
       * both to accept either.
       */
      ...(isAppleConfigured()
        ? {
            apple: async () => ({
              clientId: process.env.APPLE_CLIENT_ID as string,
              clientSecret: await generateAppleClientSecret({
                clientId: process.env.APPLE_CLIENT_ID as string,
                teamId: process.env.APPLE_TEAM_ID as string,
                keyId: process.env.APPLE_KEY_ID as string,
                privateKey: process.env.APPLE_PRIVATE_KEY as string,
              }),
              appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER,
            }),
          }
        : {}),
    },

    // `expo()` enables native clients (Req 2.1.1). `nextCookies()` must stay
    // last — it reads the cookies other plugins have queued.
    plugins: [e2eGoogleCallbackPlugin(), expo(), nextCookies()],

    databaseHooks: {
      user: {
        update: {
          /**
           * Never let a provider blank out a name we already have (Req 2.4.3).
           *
           * Apple sends the user's name ONLY on the first authorization of this
           * app by a given Apple ID — every later sign-in omits it, and
           * better-auth's Apple provider then resolves the name to `""`. With
           * `accountLinking.updateUserInfoOnLink`, linking Apple onto an
           * existing account writes that `""` straight over the real name. The
           * Apple ID's "first authorization" can easily predate the account
           * being linked (they signed in with Apple before, or deleted and
           * re-registered), so this is reachable in normal use — it is covered
           * by `__tests__/apple-sign-in.test.ts`.
           *
           * `user.name` is NOT NULL and an empty display name is never valid
           * here, so skipping the write is always right: the existing value
           * stays untouched.
           *
           * It must be `name: undefined` rather than omitting the key —
           * better-auth merges a hook's result over the original payload
           * (`{...actualData, ...result.data}`), so a deleted key comes back.
           * `undefined` is then dropped by the shared adapter factory on update,
           * for drizzle and the in-memory adapter alike.
           */
          before: async (userData) => {
            if (typeof userData.name === "string" && !userData.name.trim()) {
              return { data: { ...userData, name: undefined } };
            }
            return { data: userData };
          },
        },
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
  } satisfies BetterAuthOptions;
}
