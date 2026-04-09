import type { NextRequest } from "next/server";
import { E2E_GOOGLE_CODE } from "@/lib/e2e-google-callback";
import { auth } from "@/services/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

const authHandler = toNextJsHandler(auth);

/**
 * GET: when E2E_TEST=1 and path is callback/google with code=e2e-test-google,
 * redirect to the E2E plugin endpoint so session is created via Better Auth
 * (internalAdapter + setNewSession) and the cookie format matches getSession().
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const isE2E =
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_TEST === "1" &&
    url.pathname === "/api/auth/callback/google" &&
    url.searchParams.get("code") === E2E_GOOGLE_CODE;
  if (isE2E) {
    const e2eCallbackUrl = new URL("/api/auth/e2e-callback", request.url);
    url.searchParams.forEach((value, key) => {
      e2eCallbackUrl.searchParams.set(key, value);
    });
    return Response.redirect(e2eCallbackUrl.toString(), 302);
  }
  return authHandler.GET(request);
}

export const { POST } = authHandler;
