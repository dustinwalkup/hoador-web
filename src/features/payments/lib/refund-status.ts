/**
 * How much of a charge has been refunded, for a detail screen's payment line.
 *
 * `payment_status` describes the CHARGE and is never rewritten by a refund:
 * cancelling an accepted rental leaves `rental_requests.payment_status` at
 * `succeeded` and records the refund beside it, on the `payments` row
 * (`refund_amount`). A service booking does the same with its own
 * `refund_amount`. Read alone, the status put "Paid" on a rental the renter had
 * just been refunded for, on both parties' screens (UAT E2E-007), while payment
 * history, which reads the refund columns, was right.
 *
 * So the detail routes send this beside `paymentStatus` rather than instead of
 * it: an app that predates the field keeps reading the status it always has.
 *
 *  - `full`: everything charged came back (an owner or provider cancellation).
 *  - `partial`: some of it did (a renter cancelling keeps the service fee).
 *  - `null`: nothing has been refunded.
 */
export type RefundStatus = "full" | "partial";

/** Decimal string → integer cents, so the comparison never rides on a float. */
function toCents(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function refundStatusFor(
  chargedAmount: string | null | undefined,
  refundedAmount: string | null | undefined,
): RefundStatus | null {
  const refundedCents = toCents(refundedAmount);
  if (refundedCents === null || refundedCents <= 0) return null;

  const chargedCents = toCents(chargedAmount);
  // Without the charge there is no telling it was all of it, and "Refunded"
  // would be a claim the data cannot back.
  if (chargedCents === null) return "partial";
  return refundedCents >= chargedCents ? "full" : "partial";
}
