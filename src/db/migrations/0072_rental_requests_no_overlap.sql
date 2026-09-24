-- CONC-01: no two rental requests on one listing may hold the same day while
-- approved, active or overdue. Backstop for the approve-time re-check
-- (rentalDAL.reserveDatesForApproval), which runs under an advisory lock.
--
-- Whole days, inclusive at both ends, like findConflict: a request starting
-- the day another ends clashes. The columns are `timestamp` with arbitrary
-- times of day, so a tsrange on the raw values would reject legitimate
-- back-to-back bookings; `::date` of a timestamp without time zone is
-- immutable, so it can sit in the index expression.
--
-- Not expressible in the Drizzle schema; it lives only here.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_no_overlap"
  EXCLUDE USING gist (
    "listing_id" WITH =,
    daterange("start_date"::date, "end_date"::date, '[]') WITH &&
  )
  WHERE ("status" IN ('approved', 'active', 'overdue'));
