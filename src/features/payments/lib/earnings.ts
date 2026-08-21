import { paymentStatusEnum } from "@/db/schemas/_enums";

type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

/**
 * Owner earnings feed — shared types, filters and the row mapper.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
 * § P-E7-1 (D-E7-9, D-P1…D-P8) · Requirements 13.3.1, 13.3.2
 *
 * Kept out of the DAL on purpose. Every unit test in this repo mocks `@/db/db`,
 * so SQL semantics cannot be asserted — but the guarantees that actually matter
 * here are about *arithmetic and shape*, and those are provable when they live
 * in a pure function. `toEarningsItem` never multiplies, adds or parses a money
 * value, which is what makes "the fee is the stored number, never 20% of gross"
 * a property of the code rather than a hope.
 */

/**
 * Which payment rows count as earnings (D-P8).
 *
 * Deliberately **not** filtered by transfer status: a booking whose payout is
 * still `pending` or `frozen` is exactly the row an owner is anxious about, and
 * hiding it would defeat the transfer-status column's whole purpose.
 *
 * `completed` rides alongside `succeeded` because the enum keeps it for
 * backward compatibility (`_enums.ts`) and existing rows use it.
 */
export const EARNINGS_PAYMENT_STATUSES = [
  "succeeded",
  "completed",
] as const satisfies readonly PaymentStatus[];

/**
 * Charge rows only (D-P3).
 *
 * No `security_deposit_hold` row is written today — deposits live in
 * `rental_payment_lifecycle` and the type exists only in Stripe metadata — but
 * `paymentDAL.createPayment` accepts it and silently defaults, and a deposit
 * hold surfacing as earnings or as a renter "charge" would break the
 * hold-never-charge rule in the one screen where money is under scrutiny.
 */
export const CHARGE_PAYMENT_TYPES = [
  "rental_charge",
  "service_charge",
] as const;

/**
 * The five owner-transfer states.
 *
 * `owner_transfer_status` (rental) and `service_owner_transfer_status` (service)
 * are **two distinct pg enums with identical members** (D-P4). They are
 * normalized to this one union at the boundary so the app never sees a
 * distinction its users don't have — and `TRANSFER_STATUSES` is asserted against
 * both pg enums in a test, so a future divergence fails in CI rather than in a
 * released binary that cannot be hot-fixed.
 */
export const TRANSFER_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "frozen",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export type EarningsItem = {
  kind: "rental" | "service";
  /** The payment row's id — the stable identity for a list, unique even if a booking somehow has two (R1). */
  id: string;
  /** The rental or service booking this payment belongs to. */
  bookingId: string;
  title: string;
  counterpartyName: string;
  /** D-P1: actual return for rentals, `completedAt` for service bookings. */
  completedAt: Date | null;
  /** Decimal strings, verbatim from the database. Never parsed here. */
  gross: string;
  platformFee: string;
  net: string;
  transferStatus: TransferStatus | null;
  transferredAt: Date | null;
  /** Populated only while the payout is frozen (D-P5). */
  disputeId: string | null;
};

/** One joined row as the DAL selects it. */
export type EarningsRow = {
  paymentId: string;
  rentalId: string | null;
  serviceBookingId: string | null;
  rentalTitle: string | null;
  serviceTitle: string | null;
  counterpartyName: string | null;
  rentalCompletedAt: Date | null;
  serviceCompletedAt: Date | null;
  gross: string;
  platformFee: string;
  net: string;
  rentalTransferStatus: string | null;
  serviceTransferStatus: string | null;
  rentalTransferredAt: Date | null;
  serviceTransferredAt: Date | null;
  disputeId: string | null;
};

function asTransferStatus(value: string | null): TransferStatus | null {
  return value !== null &&
    (TRANSFER_STATUSES as readonly string[]).includes(value)
    ? (value as TransferStatus)
    : null;
}

/**
 * Map one joined row to the API shape.
 *
 * **This function performs no arithmetic.** `gross`, `platformFee` and `net`
 * are passed through exactly as the database produced them — `net` is computed
 * in SQL with Postgres `numeric`, which is exact, rather than in JavaScript,
 * where it would be a float. The app then renders three server numbers and
 * derives nothing, so the 20% platform fee is encoded in precisely one place
 * and never in a client.
 */
export function toEarningsItem(row: EarningsRow): EarningsItem {
  const isRental = row.rentalId !== null;
  const transferStatus = asTransferStatus(
    isRental ? row.rentalTransferStatus : row.serviceTransferStatus,
  );

  return {
    kind: isRental ? "rental" : "service",
    id: row.paymentId,
    bookingId: (isRental ? row.rentalId : row.serviceBookingId) ?? "",
    title: (isRental ? row.rentalTitle : row.serviceTitle) ?? "",
    counterpartyName: row.counterpartyName ?? "",
    completedAt: isRental ? row.rentalCompletedAt : row.serviceCompletedAt,
    gross: row.gross,
    platformFee: row.platformFee,
    net: row.net,
    transferStatus,
    transferredAt: isRental
      ? row.rentalTransferredAt
      : row.serviceTransferredAt,
    // D-P5: the freeze is the signal, not the dispute's own status. A dispute
    // that is resolved but whose transfer has not yet unfrozen still gets a
    // link — that gap is exactly when an owner goes looking for an explanation.
    disputeId: transferStatus === "frozen" ? row.disputeId : null,
  };
}
