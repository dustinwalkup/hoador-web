import { accountDeletionDAL, auditLogDAL, userDAL } from "@/dal";
import type { AnonymizeUserResult } from "@/dal/account-deletion.dal";
import { detachAllPaymentMethodsForCustomer } from "@/services/stripe/payment-method";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { sendRentalCancelledNotification } from "@/features/rentals/notifications/rental-cancelled";
import { sendNotification } from "@/features/notifications/utils/send-notification";
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
 *    withdraw the user's own pending requests, retain financial/audit rows).
 * 3. Detach every Stripe card on the customer **after** the commit,
 *    best-effort — a non-transactional external call must not roll back the
 *    deletion, and a Stripe outage must not leave the user un-deletable. A
 *    failure alerts ops: an attached card is still chargeable (BIZ-07).
 * 4. Tell each owner/provider whose request was withdrawn, fire-and-forget.
 * 5. Audit row with **no PII in metadata** — audit logs are retained five years
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

  const anonymized = await accountDeletionDAL.anonymizeUser(userId);

  const paymentMethodsDetached = await detachAllCards(
    userId,
    anonymized.stripeCustomerId,
  );
  notifyCounterparts(anonymized);

  await auditLogDAL.create({
    entityType: "user",
    entityId: userId,
    action: "user.self_deleted",
    userId,
    // No PII: the row outlives the scrub by five years and is append-only.
    metadata: {
      paymentMethodsDetached,
      rentalRequestsWithdrawn: anonymized.cancelledRentalRequests.length,
      serviceBookingsWithdrawn: anonymized.cancelledServiceBookings.length,
    },
  });
}

/**
 * Best-effort, after the commit: never fails the deletion. Any card left
 * attached can still be charged, so a failure goes to ops, not just Sentry.
 */
async function detachAllCards(
  userId: string,
  stripeCustomerId: string | null,
): Promise<number> {
  if (!stripeCustomerId) return 0;
  try {
    const { detached, failed } =
      await detachAllPaymentMethodsForCustomer(stripeCustomerId);
    if (failed > 0) {
      await sendOpsAlert({
        event: "account_deletion_card_detach_failed",
        message: `${failed} card(s) could not be detached after account deletion`,
        metadata: { userId, stripeCustomerId, detached, failed },
        sendEmailAlert: true,
      });
    }
    return detached;
  } catch (error) {
    // The card list itself failed: nothing was detached.
    captureNonCriticalError(error, {
      route: "account-deletion",
      action: "detach-all-payment-methods",
    });
    await sendOpsAlert({
      event: "account_deletion_card_detach_failed",
      message: "Could not list cards to detach after account deletion",
      metadata: { userId, stripeCustomerId },
      sendEmailAlert: true,
    }).catch((e) =>
      captureNonCriticalError(e, {
        route: "account-deletion",
        action: "ops-alert-card-detach",
      }),
    );
    return 0;
  }
}

/** Fire-and-forget: a notification failure must not fail the deletion. */
function notifyCounterparts(anonymized: AnonymizeUserResult): void {
  for (const request of anonymized.cancelledRentalRequests) {
    (async () => {
      const owner = await userDAL.getUserById(request.ownerId);
      await sendRentalCancelledNotification({
        recipientUserId: request.ownerId,
        recipientName:
          `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() ||
          owner.name,
        otherPartyName: "The renter",
        listingName: request.listingName,
        rentalId: request.id,
        cancelledBy: "renter",
        cancellationReason: "Renter's account was deleted",
      });
    })().catch((e) =>
      captureNonCriticalError(e, {
        route: "account-deletion",
        action: "notify-owner-request-withdrawn",
      }),
    );
  }
  for (const booking of anonymized.cancelledServiceBookings) {
    sendNotification({
      userId: booking.providerId,
      type: "system",
      title: "Booking cancelled",
      message: `The requester's account was deleted; their booking for ${booking.serviceTitle} was withdrawn.`,
      data: { bookingId: booking.id },
    }).catch((e) =>
      captureNonCriticalError(e, {
        route: "account-deletion",
        action: "notify-provider-booking-withdrawn",
      }),
    );
  }
}
