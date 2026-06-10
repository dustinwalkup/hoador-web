import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualStrings } from "@/lib/api/timing-safe-equal";

/**
 * Verify the CRON_SECRET authorization header for cron job endpoints.
 * Returns { authorized: true } if valid, or { authorized: false, response } with
 * an appropriate error response to return early.
 */
export function verifyCronSecret(
  request: NextRequest,
): { authorized: true } | { authorized: false; response: NextResponse } {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 },
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  if (
    !authHeader ||
    !timingSafeEqualStrings(authHeader, `Bearer ${cronSecret}`)
  ) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authorized: true };
}
