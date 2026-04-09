import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/utils/session";
import { getAdminUser } from "@/features/auth/utils/admin-session";

// Define protected route patterns
const PROTECTED_ROUTES = [
  "/dashboard",
  "/onboarding",
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
];

// Pages that are always accessible (no auth required; funnel users are not redirected away)
const PUBLIC_PAGE_ROUTES = ["/support", "/help"];

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
 * Check if path is a public page (support, help) that anyone can access
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

export async function proxy(request: NextRequest) {
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
      // to update the user status and redirect to join-code
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

      // Handle email_verified users (need to join community).
      // Allow /dashboard through so dashboard layout (Node runtime) can redirect;
      // layout is source of truth when proxy may run in Edge with different DB/session.
      if (user.status === "email_verified") {
        if (pathname.startsWith("/dashboard")) return NextResponse.next();
        if (pathname !== "/join-code") {
          const joinCodeUrl = new URL("/join-code", request.url);
          return NextResponse.redirect(joinCodeUrl);
        }
        return NextResponse.next();
      }

      // Handle incomplete_profile users (same: allow /dashboard for layout redirect).
      if (user.status === "incomplete_profile") {
        if (pathname.startsWith("/dashboard")) return NextResponse.next();
        if (pathname !== "/onboarding" && pathname !== "/api/onboarding") {
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

    // Redirect to login for protected routes
    const redirectUrl = createRedirectUrl(request);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ MIDDLEWARE AUTHENTICATION ERROR:", error);
    // For protected routes, redirect to login on error
    if (isProtectedRoute(pathname)) {
      const redirectUrl = createRedirectUrl(request);
      return NextResponse.redirect(redirectUrl);
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
