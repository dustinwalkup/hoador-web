import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { getDeletionBlockers } from "@/features/users/services/account-deletion-service";

/**
 * What would block the caller's self-deletion right now.
 * GET /api/users/me/deletion-blockers
 *
 * A read-only preview of the check `DELETE /api/users/me` runs, so the app can
 * show the bad news before the user types the confirmation rather than after.
 * The DELETE still re-checks: this answer can go stale.
 *
 * Responses:
 * - 200 `{ blockers }` — the 409's `blockers` shape; `[]` when deletion is clear.
 * - 401 — unauthenticated.
 *
 * Requirements: 2.5.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-14-profile-settings-account.md (P-E14-5)
 */
async function getHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    const blockers = await getDeletionBlockers(userId);

    return NextResponse.json(
      { blockers },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/users/me/deletion-blockers",
);
