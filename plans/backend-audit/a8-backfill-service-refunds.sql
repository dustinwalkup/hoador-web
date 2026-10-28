-- DRAFT, NOT RUN. Backfill service-booking refunds onto the `payments` row.
--
-- Bug: ServiceBookingService.cancelBooking recorded a refund only on
-- service_bookings.refund_amount / stripe_refund_id, never on payments, which is
-- what GET /api/payments/history (the mobile payment history) reads. The client
-- saw "Paid" with no refund line. Service dispute refunds recorded neither side.
--
-- This writes exactly what the fixed code writes (paymentDAL.recordRefund):
-- status 'refunded', refund_amount, refunded_at, refund_reason. Idempotent: it
-- only touches rows whose payments.refund_amount is still NULL.
--
-- Run the preview SELECTs first and compare the counts with the RETURNING rows.
-- Staging preview on 2026-10-26: Part A = 9 rows, Part B = 0 rows.

BEGIN;

-- Part A: cancellation refunds (client full, client partial, provider full).
-- The booking's refund_amount is what Stripe actually refunded (it is only
-- set on a successful refund). refund_reason matches the code: the trimmed
-- typed reason, else 'service_booking_cancelled' (the app maps that code to
-- copy; HOA-123).
UPDATE payments p
SET status        = 'refunded',
    refund_amount = sb.refund_amount,
    refunded_at   = COALESCE(sb.cancelled_at, sb.updated_at),
    refund_reason = COALESCE(NULLIF(btrim(sb.cancellation_reason), ''),
                             'service_booking_cancelled'),
    updated_at    = now()
FROM service_bookings sb
WHERE sb.id = p.service_booking_id
  AND sb.refund_amount IS NOT NULL
  AND sb.refund_amount > 0
  AND p.refund_amount IS NULL
  AND p.status IN ('succeeded', 'completed')
RETURNING p.id, p.service_booking_id, p.refund_amount, p.refund_reason;

-- Part B: service dispute refunds (favor_renter = full, partial_* = partial).
-- refund_full stores no amount in dispute_financial_operations; a full refund
-- of a never-refunded charge is the charge (payments.amount). One dispute per
-- booking, so at most one succeeded refund op each.
WITH dispute_refunds AS (
  SELECT d.service_booking_id,
         COALESCE(dfo.amount, p.amount) AS refund_amount,
         dfo.stripe_operation_id       AS stripe_refund_id,
         dfo.performed_at
  FROM dispute_financial_operations dfo
  JOIN disputes d ON d.id = dfo.dispute_id
  JOIN payments p ON p.service_booking_id = d.service_booking_id
  WHERE d.service_booking_id IS NOT NULL
    AND dfo.operation_type IN ('refund_full', 'refund_partial')
    AND dfo.status = 'succeeded'
    AND p.refund_amount IS NULL
),
pay AS (
  UPDATE payments p
  SET status        = 'refunded',
      refund_amount = dr.refund_amount,
      refunded_at   = dr.performed_at,
      refund_reason = 'dispute_refund',
      updated_at    = now()
  FROM dispute_refunds dr
  WHERE p.service_booking_id = dr.service_booking_id
    AND p.refund_amount IS NULL
  RETURNING p.id, p.service_booking_id, p.refund_amount
)
UPDATE service_bookings sb
SET refund_amount   = dr.refund_amount,
    stripe_refund_id = COALESCE(sb.stripe_refund_id, dr.stripe_refund_id),
    updated_at      = now()
FROM dispute_refunds dr
WHERE sb.id = dr.service_booking_id
  AND sb.refund_amount IS NULL
RETURNING sb.id, sb.refund_amount;

-- Check the RETURNING rows against the preview, then:
COMMIT;   -- or ROLLBACK;

-- Preview (read-only), run before the BEGIN above:
-- SELECT count(*) FROM payments p JOIN service_bookings sb ON sb.id = p.service_booking_id
--  WHERE sb.refund_amount > 0 AND p.refund_amount IS NULL AND p.status IN ('succeeded','completed');
-- SELECT count(*) FROM dispute_financial_operations dfo JOIN disputes d ON d.id = dfo.dispute_id
--  JOIN payments p ON p.service_booking_id = d.service_booking_id
--  WHERE dfo.operation_type IN ('refund_full','refund_partial') AND dfo.status = 'succeeded'
--    AND p.refund_amount IS NULL;
