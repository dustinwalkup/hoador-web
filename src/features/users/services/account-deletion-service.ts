import { accountDeletionDAL, auditLogDAL } from "@/dal";
import { detachPaymentMethod } from "@/services/stripe/payment-method";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import {
  AccountDeletionBlockedError,
  type AccountDeletionBlocker,
} from "../lib/account-deletion-errors";

/**
 * A blocker class: how to count it and how to describe it if present.
 * Kept as data so the checks stay uniform and the messages live in one place.
 */
const BLOCKER_CHECKS: {
  type: AccountDeletionBlocker["type"];
  count: (userId: string) => Promise<number>;
  message: (n: number) => string;
}[] = [
  {
    type: "active_rentals",
    count: (u) => accountDeletionDAL.countActiveRentals(u),
    message: (n) =>
      `You have ${n} active ${plural(n, "rental")}. These must be completed or cancelled first.`,
  },
  {
    type: "active_bookings",
    count: (u) => accountDeletionDAL.countActiveBookings(u),
    message: (n) =>
      `You have ${n} active service ${plural(n, "booking")}. These must be completed or cancelled first.`,
  },
  {
    type: "pending_requests",
    count: (u) => accountDeletionDAL.countPendingOwnedRequests(u),
    message: (n) =>
      `You have ${n} pending ${plural(n, "request")} awaiting your response. Respond to or let them expire first.`,
  },
  {
    type: "deposit_holds",
    count: (u) => accountDeletionDAL.countActiveDepositHolds(u),
    message: (n) =>
      `You have ${n} active security ${plural(n, "deposit")} held. These must be released first.`,
  },
  {
    type: "incomplete_payouts",
    count: (u) => accountDeletionDAL.countIncompletePayouts(u),
    message: (n) =>
      `You have ${n} ${plural(n, "payout")} still processing. These must complete first.`,
  },
  {
    type: "open_disputes",
    count: (u) => accountDeletionDAL.countOpenDisputes(u),
    message: (n) =>
      `You have ${n} open ${plural(n, "dispute")}. These must be resolved first.`,
  },
];

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/**
 * Everything standing between a user and self-deletion, or `[]` if clear.
 *
 * All classes run concurrently — they are independent reads and a blocked
 * deletion should report *every* blocker at once, not the first one found, so
 * the app can show the full list (Req 2.5.2).
 *
 * Requirements: 2.5.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.1
 */
export async function getDeletionBlockers(
  userId: string,
): Promise<AccountDeletionBlocker[]> {
  const counts = await Promise.all(
    BLOCKER_CHECKS.map((check) => check.count(userId)),
  );

  const blockers: AccountDeletionBlocker[] = [];
  BLOCKER_CHECKS.forEach((check, i) => {
    const n = counts[i];
    if (n > 0) {
      blockers.push({ type: check.type, count: n, message: check.message(n) });
    }
  });

  return blockers;
}

/**
 * Self-service account deletion: refuse if blocked, otherwise anonymize.
 *
 * Order is load-bearing:
 * 1. Blockers first — throw `AccountDeletionBlockedError` (409) before any
 *    mutation, so a blocked attempt changes nothing.
 * 2. Anonymize in a single transaction (PII scrub, session revoke, delist,
 *    retain financial/audit rows).
 * 3. Stripe PM detach **after** the commit, best-effort — a non-transactional
 *    external call must not roll back the deletion, and a Stripe outage must not
 *    leave the user un-deletable. Local PM rows are already deactivated in the
 *    transaction, so a failed detach only leaves an orphaned Stripe object, not
 *    a usable card.
 * 4. Audit row with **no PII in metadata** — audit logs are retained five years
 *    and append-only, and would otherwise re-introduce the email just scrubbed.
 *
 * Requirements: 2.5.1, 2.5.3
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.2
 */
export async function deleteOwnAccount(userId: string): Promise<void> {
  const blockers = await getDeletionBlockers(userId);
  if (blockers.length > 0) {
    throw new AccountDeletionBlockedError({ blockers });
  }

  const { paymentMethodIds } = await accountDeletionDAL.anonymizeUser(userId);

  // Best-effort, outside the transaction. Each detach is independent — one
  // failing must not skip the rest.
  await Promise.all(
    paymentMethodIds.map((pmId) =>
      detachPaymentMethod(pmId).catch((error) =>
        captureNonCriticalError(error, {
          route: "account-deletion",
          action: "detach-payment-method",
        }),
      ),
    ),
  );

  await auditLogDAL.create({
    entityType: "user",
    entityId: userId,
    action: "user.self_deleted",
    userId,
    // No PII: the row outlives the scrub by five years and is append-only.
    metadata: { paymentMethodsDetached: paymentMethodIds.length },
  });
}
