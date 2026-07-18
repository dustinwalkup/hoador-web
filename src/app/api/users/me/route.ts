import { NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { deleteOwnAccount } from "@/features/users/services/account-deletion-service";

/**
 * Self-service account deletion.
 * DELETE /api/users/me
 *
 * Distinct from the admin delete (`DELETE /api/admin/users/[userId]`), which
 * hard-deletes and cascades financial rows. This anonymizes: PII is scrubbed and
 * sessions revoked, but payments/rentals/disputes/audit rows are retained.
 *
 * Responses:
 * - 200 `{ success: true }` — deleted; the app then purges local data and shows
 *   the signed-out state (Req 2.5.3). Sessions are already revoked server-side.
 * - 409 `{ error: "ACCOUNT_DELETION_BLOCKED", blockers }` — obligations remain
 *   (mapped from `AccountDeletionBlockedError` by `handleApiError`).
 * - 401 — unauthenticated.
 *
 * Requirements: 2.5.1, 2.5.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.3
 */
async function deleteHandler() {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId } = authResult;

    await deleteOwnAccount(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    // The 409 blocked-deletion mapping lives in the real handleApiError — the
    // whole point of the endpoint — so it is exercised, not stubbed, in tests.
    return handleApiError(error);
  }
}

export const DELETE = withRequestLogging(deleteHandler, "DELETE /api/users/me");
