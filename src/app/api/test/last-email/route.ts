import { NextRequest } from "next/server";
import { getLastCapturedUrl } from "@/test/e2e/email-capture";

export const dynamic = "force-dynamic";

type EmailType = "verification" | "reset";

/**
 * GET /api/test/last-email
 *
 * Test-only route. Returns 404 when E2E_TEST is not set.
 *
 * Query:
 *   type - "verification" | "reset" (default: "verification")
 *
 * Response when E2E_TEST=1:
 *   { url: string | null }
 *   - url is the last captured link for that type, or null if none has been
 *     captured yet (e.g. no verification or reset email has been sent this run).
 */
export async function GET(request: NextRequest) {
  if (process.env.E2E_TEST !== "1") {
    return new Response(null, { status: 404 });
  }

  const type = (request.nextUrl.searchParams.get("type") ?? "verification") as
    | EmailType
    | string;
  const validType: EmailType =
    type === "verification" || type === "reset" ? type : "verification";

  const url = getLastCapturedUrl(validType);
  return Response.json({ url });
}
