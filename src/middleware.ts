import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/utils/session";

// Define protected route patterns
const PROTECTED_ROUTES = [
  "/dashboard",
  "/onboarding", // Add onboarding as protected
  "/api/garage",
  "/api/listings",
  "/api/rentals",
  "/api/messages",
];

// Define auth routes that authenticated users shouldn't access
const AUTH_ROUTES = ["/login", "/signup", "/verify-email"];

// Define callback routes that pending_verification users can access
const VERIFICATION_CALLBACK_ROUTES = [
  "/signup/email/callback",
  "/signup/google/callback",
];

// Define public API routes that should not be protected
const PUBLIC_API_ROUTES = ["/api/auth", "/api/test-serp", "/api/test-upload"];

// Define static file extensions and Next.js internal paths to skip
const SKIP_MIDDLEWARE_PATHS = [
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

/**
 * Check if a path matches any of the protected route patterns
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a path is a public API route that should not be protected
 */
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  // Skip middleware for public API routes
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  try {
    // Get current user (includes session check)
    const user = await getCurrentUser();

    // Handle authenticated users
    if (user) {
      // Allow pending_verification users to access callback routes
      if (
        user.status === "pending_verification" &&
        VERIFICATION_CALLBACK_ROUTES.some((route) => pathname.startsWith(route))
      ) {
        return NextResponse.next();
      }

      // Redirect authenticated users away from auth routes
      if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
      }

      // Redirect authenticated users from home page to dashboard
      if (pathname === "/") {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
      }

      // Handle incomplete_profile users
      if (user.status === "incomplete_profile") {
        if (pathname === "/onboarding") {
          return NextResponse.next(); // Allow access to onboarding
        }
        // Redirect to onboarding for any other route
        const onboardingUrl = new URL("/onboarding", request.url);
        return NextResponse.redirect(onboardingUrl);
      }

      // Handle users who don't need onboarding
      if (pathname === "/onboarding") {
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
