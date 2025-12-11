import { NextRequest } from "next/server";

/**
 * Extract client IP address from Next.js request
 * Handles various proxy headers and fallbacks
 */
export function getClientIP(request: NextRequest): string | null {
  // Check various headers that might contain the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(",")[0]?.trim() || null;
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // No IP found in headers
  return null;
}

/**
 * Extract user agent string from Next.js request
 */
export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get("user-agent") || null;
}
