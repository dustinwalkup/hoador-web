import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Define protected route patterns
const PROTECTED_ROUTES = [
  "/dashboard",
  "/api/garage",
  "/api/listings",
  "/api/rentals",
  "/api/messages",
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

  // Add callback URL for seamless redirect after login
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
    // Check session using Better Auth
    const sessionCookie = getSessionCookie(request);

    // Handle authenticated users on home page - redirect to dashboard
    if (sessionCookie && pathname === "/") {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // Only run authentication check for protected routes
    if (!isProtectedRoute(pathname)) {
      return NextResponse.next();
    }

    // If no valid session, redirect to login
    if (!sessionCookie) {
      const redirectUrl = createRedirectUrl(request);
      return NextResponse.redirect(redirectUrl);
    }

    // User is authenticated, allow the request to proceed
    return NextResponse.next();
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
