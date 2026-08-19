import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/utils/session";
import { getAdminUser } from "@/features/auth/utils/admin-session";
import { SESSION_EXPIRED_MESSAGE } from "@/features/auth/constants";

// Define protected route patterns
const PROTECTED_ROUTES = [
  "/dashboard",
  "/onboarding",
  "/community-select",
  "/join-code",
  "/api/garage",
  "/api/listings",
  "/api/rentals",
  "/api/messages",
];

// Define admin routes that require admin privileges
const ADMIN_ROUTES = ["/admin/dashboard"];

// Define auth routes that authenticated users shouldn't access
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/verify-email",
  "/community-select",
  "/join-code",
  "/onboarding",
];

// Define callback routes that pending_verification users can access
const VERIFICATION_CALLBACK_ROUTES = [
  "/signup/email/callback",
  "/signup/google/callback",
  "/signup/google/legal-acceptance",
];

// Define public API routes that should not be protected
const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/test-serp",
  "/api/test-upload",
  "/api/profile",
];

// Define static file extensions and Next.js internal paths to skip
const SKIP_MIDDLEWARE_PATHS = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  // Apple association files must be publicly reachable without any auth
  // redirect (AASA for universal links + the Sign in with Apple domain-
  // association file). The `includes(".")` heuristic below already skips these,
  // but list the prefix explicitly so the public contract is intentional.
  "/.well-known",
];

// Pages that are always accessible (no auth required; funnel users are not redirected away)
const PUBLIC_PAGE_ROUTES = ["/support", "/help", "/how-it-works"];

/**
 * How to refuse an unauthenticated request to a protected path.
 *
 * **Pages redirect to /login. API routes get a 401.** Redirecting an `/api/*`
 * request to the login PAGE is actively harmful: the caller follows the 307 and
 * receives HTML with status **200**, so `res.ok` is true and `res.json()`
 * throws. Neither the web query layer nor the mobile client can recognise an
 * expired session from that — the app surfaces a parse error instead of bouncing
 * to sign-in (found from the mobile app, 2026-08-19).
 *
 * Only the four protected API prefixes (`/api/garage`, `/api/listings`,
 * `/api/rentals`, `/api/messages`) ever reached this path; every other `/api/*`
 * route already 401s at the route level, so this makes them consistent.
 */
function refuseUnauthenticated(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: SESSION_EXPIRED_MESSAGE },
      { status: 401 },
    );
  }
  return NextResponse.redirect(createRedirectUrl(request));
}

/**
 * Check if a path matches any of the protected route patterns
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a path is an admin route
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a path is a public API route that should not be protected
 */
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if path is a public page (support, help, how-it-works) that anyone can access
 */
function isPublicPageRoute(pathname: string): boolean {
  return PUBLIC_PAGE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

/**
 * Check if middleware should skip processing this path
 */
function shouldSkipMiddleware(pathname: string): boolean {
  // Skip static files and Next.js internals
  if (SKIP_MIDDLEWARE_PATHS.some((path) => pathname.startsWith(path))) {
    return true;
  }

  // Skip files with extensions (images, fonts, etc.)
  if (pathname.includes(".") && !pathname.endsWith("/")) {
    return true;
  }

  return false;
}

/**
 * Create redirect URL with callback parameter
 */
function createRedirectUrl(request: NextRequest): string {
  const loginUrl = new URL("/login", request.url);

  // Add callback URL for redirect after login
  const callbackUrl = request.nextUrl.pathname + request.nextUrl.search;
  if (callbackUrl !== "/") {
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return loginUrl.toString();
}

/**
 * Captures the Facebook Ads click ID from `?fbclid=…` into the `_fbc` cookie.
 *
 * Format is `fb.{subdomain_index}.{unix_ms}.{fbclid}` — anything else is
 * silently dropped by Meta. Skips when `_fbc` is already set so a deep-link
 * inside the same session does not overwrite the original click attribution.
 * Cookie TTL is 90 days (Meta's documented click-through window).
 *
 * Returns the value to set, or null when nothing needs to change.
 */
const FBC_COOKIE_NAME = "_fbc";
const FBC_TTL_SECONDS = 60 * 60 * 24 * 90;

function computeFbcCookieValue(request: NextRequest): string | null {
  const fbclid = request.nextUrl.searchParams.get("fbclid");
  if (!fbclid) return null;
  if (request.cookies.get(FBC_COOKIE_NAME)?.value) return null;
  return `fb.1.${Date.now()}.${fbclid}`;
}

function attachFbcCookie(response: NextResponse, value: string): NextResponse {
  response.cookies.set({
    name: FBC_COOKIE_NAME,
    value,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: FBC_TTL_SECONDS,
  });
  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const response = await proxyAuth(request);
  const fbcValue = computeFbcCookieValue(request);
  return fbcValue ? attachFbcCookie(response, fbcValue) : response;
}

async function proxyAuth(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  // Skip middleware for public API routes
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // E2E: proxy runs in Edge and cannot use E2E DB (Node pg). Let protected routes
  // through so dashboard layout (Node) does auth and status-based redirects.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_TEST === "1" &&
    isProtectedRoute(pathname)
  ) {
    return NextResponse.next();
  }

  try {
    // Check admin routes first - require admin privileges
    if (isAdminRoute(pathname)) {
      const adminUser = await getAdminUser();
      if (!adminUser) {
        // Redirect to standard login (callbackUrl preserves intended admin path for after login)
        const redirectUrl = createRedirectUrl(request);
        return NextResponse.redirect(redirectUrl);
      }
      // Admin user accessing admin route - allow
      return NextResponse.next();
    }

    // Get current user (includes session check)
    const user = await getCurrentUser();

    // Handle authenticated users
    if (user) {
      // Allow public pages (support, help) regardless of verification/onboarding state
      if (isPublicPageRoute(pathname)) {
        return NextResponse.next();
      }
      // FIRST: Always allow callback routes regardless of status
      if (
        VERIFICATION_CALLBACK_ROUTES.some((route) => pathname.startsWith(route))
      ) {
        return NextResponse.next();
      }

      // If email is not verified, redirect to verify email
      if (user.emailVerified === false) {
        if (pathname !== "/verify-email") {
          const verifyEmailUrl = new URL("/verify-email", request.url);
          return NextResponse.redirect(verifyEmailUrl);
        }
        return NextResponse.next();
      }

      // If email is verified, but user status is 'pending_verification', user created an account
      // with Google via the sign in method, big no no, redirect to google callback
      // to update the user status and redirect to community-select
      // Allow access to legal acceptance page so users can accept documents
      if (user.status === "pending_verification") {
        if (
          pathname !== "/signup/google/callback" &&
          pathname !== "/signup/google/legal-acceptance"
        ) {
          const redirectUrl = new URL("/signup/google/callback", request.url);
          return NextResponse.redirect(redirectUrl);
        }
        return NextResponse.next();
      }

      // Handle email_verified users (need to select a community).
      // Allow /dashboard through so dashboard layout (Node runtime) can redirect;
      // layout is source of truth when proxy may run in Edge with different DB/session.
      if (user.status === "email_verified") {
        if (pathname.startsWith("/dashboard")) return NextResponse.next();
        // API routes self-authenticate — never redirect a fetch() to an HTML
        // page (e.g. the /community-select dropdown fetching /api/communities).
        if (pathname.startsWith("/api/")) return NextResponse.next();
        // Allow both /community-select (canonical) and /join-code (legacy)
        // for email_verified users — R1.5 keeps the legacy invite-code flow live.
        if (pathname === "/community-select" || pathname === "/join-code") {
          return NextResponse.next();
        }
        const selectUrl = new URL("/community-select", request.url);
        return NextResponse.redirect(selectUrl);
      }

      // Handle incomplete_profile users (same: allow /dashboard for layout redirect).
      if (user.status === "incomplete_profile") {
        if (pathname.startsWith("/dashboard")) return NextResponse.next();
        // API routes self-authenticate; don't redirect fetch() calls to HTML.
        if (pathname.startsWith("/api/")) return NextResponse.next();
        if (pathname !== "/onboarding") {
          const onboardingUrl = new URL("/onboarding", request.url);
          return NextResponse.redirect(onboardingUrl);
        }
        return NextResponse.next();
      }

      // Redirect authenticated users from home page to dashboard
      if (pathname === "/") {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
      }

      // Redirect active users away from auth routes
      if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
      }

      // User is authenticated with proper status, allow access
      return NextResponse.next();
    }

    // Handle unauthenticated users
    // Only run authentication check for protected routes
    if (!isProtectedRoute(pathname)) {
      return NextResponse.next();
    }

    // Refuse protected routes: pages redirect to login, APIs 401.
    return refuseUnauthenticated(request, pathname);
  } catch (error) {
    console.error("❌ MIDDLEWARE AUTHENTICATION ERROR:", error);
    // Same split on the error path — an auth check that THREW must not hand an
    // API caller an HTML login page either.
    if (isProtectedRoute(pathname)) {
      return refuseUnauthenticated(request, pathname);
    }
    return NextResponse.next();
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|tiff)$).*)",
  ],
};
