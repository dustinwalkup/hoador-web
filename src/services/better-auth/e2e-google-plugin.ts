/**
 * E2E-only plugin: GET /api/auth/e2e-callback creates a session via Better Auth's
 * internalAdapter and setSessionCookie so the cookie format matches getSession().
 * Used when E2E_TEST=1; test redirects to this after intercepting Google OAuth.
 * Returns a NextResponse.redirect with Set-Cookie so the browser receives the
 * session on the redirect response (ctx.redirect() may not merge headers).
 */
import { NextResponse } from "next/server";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";

const DEFAULT_E2E_GOOGLE_EMAIL = "google@e2e.test";

export function e2eGoogleCallbackPlugin(): BetterAuthPlugin {
  return {
    id: "e2e-google-callback",
    endpoints: {
      e2eCallback: createAuthEndpoint(
        "/e2e-callback",
        { method: "GET" },
        async (ctx) => {
          if (process.env.E2E_TEST !== "1") {
            return ctx.json({ error: "Not in E2E mode" }, { status: 404 });
          }

          const requestUrl = ctx.request?.url ?? "";
          const url = new URL(requestUrl);
          const email =
            url.searchParams.get("e2e_user") || DEFAULT_E2E_GOOGLE_EMAIL;
          const stateRaw = url.searchParams.get("state") || "";
          const stateDecoded = stateRaw ? decodeURIComponent(stateRaw) : "";
          const baseURL =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
          const base = baseURL.replace(/\/$/, "");

          // E2E test explicitly requests this user → always send to join-code.
          const E2E_EMAIL_VERIFIED = "email_verified@e2e.test";
          const forceJoinCode = email === E2E_EMAIL_VERIFIED;
          let redirectUrl = forceJoinCode
            ? `${base}/join-code`
            : `${base}${
                stateDecoded.startsWith("/") ? stateDecoded : "/dashboard"
              }`;

          try {
            const { internalAdapter } = ctx.context;

            const found = await internalAdapter.findUserByEmail(email);
            let user = found?.user ?? null;
            if (!user) {
              const result = await internalAdapter.createOAuthUser(
                {
                  name: email.split("@")[0],
                  email,
                  emailVerified: true,
                  image: null,
                },
                {
                  accountId: `e2e-google-${email}`,
                  providerId: "google",
                },
              );
              user = result.user;
              await internalAdapter.updateUser(user.id, {
                status: "active",
              } as Parameters<typeof internalAdapter.updateUser>[1]);
              const refreshed = await internalAdapter.findUserById(user.id);
              user = refreshed ?? user;
            } else {
              const accounts = await internalAdapter.findAccounts(user.id);
              const hasGoogle = accounts.some((a) => a.providerId === "google");
              if (!hasGoogle) {
                await internalAdapter.createAccount({
                  accountId: `e2e-google-${user.id}`,
                  providerId: "google",
                  userId: user.id,
                } as Parameters<typeof internalAdapter.createAccount>[0]);
              }
            }

            if (!user) {
              return ctx.json(
                { error: "User not found after create" },
                { status: 500 },
              );
            }

            // Status-based redirect: adapter may not return our custom status.
            // Fetch from DB so E2E tests land on the right page.
            const { db } = await import("@/db/db");
            const { user: userTable } =
              await import("@/db/schemas/user.schema");
            const { eq } = await import("drizzle-orm");
            const [row] = await db
              .select({ status: userTable.status })
              .from(userTable)
              .where(eq(userTable.id, user.id))
              .limit(1);
            if (!forceJoinCode) {
              const status =
                row?.status ?? (user as { status?: string }).status;
              const redirectPath =
                status === "email_verified"
                  ? "/join-code"
                  : status === "incomplete_profile"
                    ? "/onboarding"
                    : stateDecoded.startsWith("/")
                      ? stateDecoded
                      : "/dashboard";
              redirectUrl = `${base}${redirectPath}`;
            }

            const session = await internalAdapter.createSession(user.id);
            await setSessionCookie(ctx, { session, user });
            ctx.context.setNewSession({ session, user });

            // Return redirect with Set-Cookie so the browser gets the session.
            // setSessionCookie sets on ctx.context.responseHeaders (Better Auth).
            const responseHeaders = (
              ctx as { context?: { responseHeaders?: Headers } }
            ).context?.responseHeaders;
            const setCookie =
              responseHeaders?.get?.("set-cookie") ??
              (
                ctx as { response?: { headers?: Headers } }
              ).response?.headers?.get?.("set-cookie");
            const res = NextResponse.redirect(redirectUrl, 302);
            if (setCookie) {
              res.headers.set("set-cookie", setCookie);
            }
            return res;
          } catch (err) {
            if (err instanceof APIError) throw err;
            const message = err instanceof Error ? err.message : String(err);
            if (ctx.context.logger?.error) {
              ctx.context.logger.error("E2E callback failed", err);
            }
            return ctx.json(
              { error: "E2E callback failed", detail: message },
              { status: 500 },
            );
          }
        },
      ),
    },
  };
}
