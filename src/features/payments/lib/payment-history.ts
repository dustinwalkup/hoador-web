import { depositHoldStatusEnum, paymentStatusEnum } from "@/db/schemas/_enums";
import { CHARGE_PAYMENT_TYPES } from "./earnings";

/**
 * Renter/requester payment history — types and the row mapper.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
 * § P-E7-2 (D-E7-10, D-P2, D-P3, D-P6) · Requirements 12.2.1, 12.2.2, 14.1.4, 14.1.5
 *
 * The mirror of the earnings feed: same backbone, `payerId` instead of
 * `payeeId`. Pure for the same reason — it is where the deposit-vs-charge
 * distinction is decided, and that is worth being able to prove.
 */

export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type DepositHoldStatus =
  (typeof depositHoldStatusEnum.enumValues)[number];

export { CHARGE_PAYMENT_TYPES };

export type PaymentHistoryItem = {
  kind: "rental" | "service";
  id: string;
  bookingId: string;
  title: string;
  counterpartyName: string;
  date: Date | null;
  /** Decimal string, verbatim from the database. */
  amount: string;
  status: PaymentStatus | null;
  refundAmount: string | null;
  refundedAt: Date | null;
  refundReason: string | null;
  /**
   * Rental rows only — **absent** on service rows, never `not_applicable`
   * (D-P6).
   *
   * Service bookings have no deposit lifecycle at all: `service_payment_lifecycle`
   * has no such column, because a deposit is a rental-only concept. Coercing that
   * to `not_applicable` would be the server inventing a value for a question the
   * row cannot be asked. The app treats absent exactly like `not_applicable` —
   * no deposit UI — but the two arrive here honestly distinct.
   */
  depositHoldStatus?: DepositHoldStatus;
};

export type PaymentHistoryRow = {
  paymentId: string;
  rentalId: string | null;
  serviceBookingId: string | null;
  rentalTitle: string | null;
  serviceTitle: string | null;
  counterpartyName: string | null;
  date: Date | null;
  amount: string;
  status: string | null;
  refundAmount: string | null;
  refundedAt: Date | null;
  refundReason: string | null;
  depositHoldStatus: string | null;
};

function asPaymentStatus(value: string | null): PaymentStatus | null {
  return value !== null &&
    (paymentStatusEnum.enumValues as readonly string[]).includes(value)
    ? (value as PaymentStatus)
    : null;
}

function asDepositHoldStatus(value: string | null): DepositHoldStatus | null {
  return value !== null &&
    (depositHoldStatusEnum.enumValues as readonly string[]).includes(value)
    ? (value as DepositHoldStatus)
    : null;
}

/**
 * Map one joined row to the API shape.
 *
 * Performs no arithmetic: `amount` and `refundAmount` are passed through as the
 * decimal strings the database produced. A refund is its **own** pair of fields,
 * never netted off `amount` — a renter needs to see that they were charged $80
 * and refunded $30, not that they were charged $50.
 */
export function toPaymentHistoryItem(
  row: PaymentHistoryRow,
): PaymentHistoryItem {
  const isRental = row.rentalId !== null;
  const deposit = isRental ? asDepositHoldStatus(row.depositHoldStatus) : null;

  const item: PaymentHistoryItem = {
    kind: isRental ? "rental" : "service",
    id: row.paymentId,
    bookingId: (isRental ? row.rentalId : row.serviceBookingId) ?? "",
    title: (isRental ? row.rentalTitle : row.serviceTitle) ?? "",
    counterpartyName: row.counterpartyName ?? "",
    date: row.date,
    amount: row.amount,
    status: asPaymentStatus(row.status),
    refundAmount: row.refundAmount,
    refundedAt: row.refundedAt,
    refundReason: row.refundReason,
  };

  // The key is added only when there is a real value — `undefined` would
  // serialize away anyway, but an explicit omission is what makes "absent" and
  // "not_applicable" distinguishable to the client (D-P6).
  if (deposit !== null) {
    item.depositHoldStatus = deposit;
  }

  return item;
}
