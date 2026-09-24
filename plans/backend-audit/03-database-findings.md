# Database, Drizzle and DAL findings

Covers schema constraints, referential actions, transactions, migrations and DAL correctness. Several database-rooted issues were consolidated into the documents where their impact lands: the non-transactional approve path (BIZ-01, BIZ-12), missing overlap constraint (CONC-01), chargeback FK violation (BIZ-06), anonymized-user charging (BIZ-07), drizzle error wrapping (SEC-16) and CAS gaps (CONC-02, CONC-09).

How to read this document:

- IDs are the audit's final IDs (see `09-priority-matrix.md`). Each finding lists the auditor report(s) it was consolidated from; duplicates reported by several auditors were merged into one finding.
- Every CRITICAL/HIGH finding was re-verified by the lead auditor against the source code in a second, adversarial pass; the verdict box says what was checked and whether the grade changed. MEDIUM/LOW findings were spot-checked, not all independently re-traced.
- "Auditor's original grading" preserves the auditor's own severity and confidence line; the headline severity above it is the final one.
- Paths are relative to `hoador-web/` unless prefixed `hoador-mobile/` or `m:` (mobile). References such as "Open question 1" point to the auditor open questions reproduced at the end of this document.
- Audited at `hoador-web` develop `21bdc61` (2026-09-23). Read-only: no application code was changed.

## Summary

Findings in this document: CRITICAL 0 · HIGH 1 · MEDIUM 3 · LOW 0.

| ID    | Severity | Confidence | Finding                                                                                                                                               | Plan                                                                    |
| ----- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| DB-01 | HIGH     | High       | Deleting a listing (any owner) or a user (superadmin) cascade-deletes completed rentals' payments, payout lifecycle, agreements and legal acceptances | [R-DB-01](remediations/R-DB-01-preserve-financial-records-on-delete.md) |
| DB-02 | MEDIUM   | High       | Migration history cannot rebuild the schema, silently skips two migrations, and `push` to production is offered in CI                                 | —                                                                       |
| DB-03 | MEDIUM   | High       | 'Delete conversation' hard-deletes the shared thread, including the counterparty's messages                                                           | —                                                                       |
| DB-04 | MEDIUM   | High       | The dispute financial ledger records deposit releases and skips as capture_deposit, and participants see them                                         | —                                                                       |

## Findings

### DB-01: Deleting a listing (any owner) or a user (superadmin) cascade-deletes completed rentals' payments, payout lifecycle, agreements and legal acceptances

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** DB-06, BIZ-12
**Remediation plan:** [R-DB-01](remediations/R-DB-01-preserve-financial-records-on-delete.md)

> **Adversarial review (lead auditor):** Upgraded the business-logic auditor's MEDIUM to HIGH, matching the database auditor. Verified the cascade chain (`src/db/schemas/rentals.schema.ts:31,141,145`; `rental-payment-lifecycle.schema.ts:24`; `payments.schema.ts:23,28`) and that the deletion guard deliberately ignores terminal rentals (`src/features/listings/services/listing-service.ts:329`). It is also a dispute-evasion vector: deleting the listing inside the 24h window, before the renter files, erases the rental.

- _Auditor's original grading:_ HIGH | **Confidence:** High
- **Files:** `listing-service.ts:329-375`; `listing.dal.ts:685-688`; `rentals.schema.ts:30-38,140-146`; `payments.schema.ts:22-35`; `rental-payment-lifecycle.schema.ts:23-25`; `rental-agreement-documents.schema.ts:17-20`; `legal-documents.schema.ts:48-54`; `admin/users/[userId]/route.ts:175-186`
- **Affected routes:** DELETE `/api/listings/[listingId]`; DELETE `/api/admin/users/[userId]`
- **Relevant code:**

```ts
 * Completed, cancelled and denied rentals do NOT block — they are terminal,   // listing-service.ts:329
const result = await this.db.delete(listings).where(eq(listings.id, id)).returning(); // listing.dal.ts:685-688
```

- **What is wrong:**
  - Every link in `listings→rental_requests→rentals→payments / rental_payment_lifecycle / agreements / user_legal_acceptances` is `ON DELETE CASCADE`.
  - The deletion guard blocks only pending, approved and active rentals. Only a dispute (RESTRICT) or a review (NO ACTION) stops the cascade.
  - User hard-delete has no guard at all, and also cascades through `payments.payer_id` / `payee_id`, `rental_requests.*` and `disputes.created_by`.
- **Exploit / failure scenario:** The owner confirms the return (payout still pending, deposit held) and then deletes the listing. As a result:
  - the renter's charge record, the lifecycle row (charge and transfer ids), the agreement and the renter's legal acceptances are deleted;
  - the dispute window closes ("Rental not found");
  - the deposit hold waits out Stripe's 7-day expiry;
  - chargeback linking fails.
- **Mitigating layers checked:** Stripe keeps its own records, `audit_logs` has no FK, and the service tables use RESTRICT.
- **Real-world impact:** Financial and legal records are destroyed by a routine owner action.
- **Recommended fix:**
  - Change those FKs to `ON DELETE RESTRICT`.
  - Soft-delete listings that have any rental.
  - Give admin hard-delete the same blockers as self-deletion.
  - Also fix `dispute_financial_operations.performed_by`, which is `NOT NULL` + `SET NULL` (`disputes.schema.ts:178-180`).
- **Tests needed:** Deleting a listing that has a completed rental returns 409 or soft-deletes.
- **Related:** BIZ-07

### DB-02: Migration history cannot rebuild the schema, silently skips two migrations, and `push` to production is offered in CI

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** DB-11

> **Adversarial review (lead auditor):** Kept MEDIUM (disaster-recovery and new-environment risk).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `meta/_journal.json:113-128`; `0015_sturdy_phantom_reporter.sql:1-2`; `0017_add_dispute_reference_number.sql:2,16,25`; `0018_young_amphibian.sql:1-2`; `0000_setup_fields.sql:1-11`; `node_modules/drizzle-orm/pg-core/dialect.js:56-62`; `.github/workflows/database.yml:8-25,64-80`; `scripts/e2e-setup.ts:1-6`
- **Affected routes:** n/a (ops)
- **Relevant code:** `if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis)` (`dialect.js:62`)
- **What is wrong:**
  - Only `0015_hesitant_obadiah_stane` is in the journal (idx 15). `0015_sturdy_phantom_reporter` (`legal_documents` PK → `(id,version)`) never runs. The snapshots from 0016 on already include that change, so it is never re-emitted.
  - 0017 has `when` 1737878400000 (2025-01-26), which is earlier than 0016's 1769375611862 (2026-01-25). The migrator therefore skips 0017 on every existing DB.
  - 0018 re-adds the same column.
  - No migration creates the base tables (`user`, `listings`, `rentals`, `payments`).
  - The e2e setup uses `db:push`.
  - `database.yml` offers `push` to `production`.
  - All pending migrations run in a single transaction, which contradicts the comment in 0066.
- **Exploit / failure scenario:** On a database built only with `migrate`, `legal_documents` keeps a PK of `(id)` alone, so `LegalDocumentDAL.createVersion` fails for the second version of any document. Disaster recovery or a new environment cannot be built from the migrations.
- **Mitigating layers checked:** Prod was probably reconciled via `push` (unknown).
- **Real-world impact:** Hidden schema drift, and prod failure risk on disaster recovery or a new environment.
- **Recommended fix:**
  - Introspect prod and diff it against the TS schema.
  - Squash to a baseline migration.
  - Journal or delete 0015_sturdy.
  - Fix 0017's `when`.
  - Add a CI job that migrates an empty DB and runs `drizzle-kit check`.
  - Remove the prod `push` option.
- **Tests needed:** The CI migrate job.
- **Related:** Open question 2

### DB-03: 'Delete conversation' hard-deletes the shared thread, including the counterparty's messages

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** DB-13

> **Adversarial review (lead auditor):** Kept MEDIUM (cross-user loss of rental communications; possible evidence destruction).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. Whether this is intended is Open question 4.
- **Files:** `messages.dal.ts:950-955`; `messages.schema.ts:56-58`; `messages/conversations/[conversationId]/route.ts:71-98`
- **Affected routes:** DELETE `/api/messages/conversations/[conversationId]`
- **Relevant code:** `await this.db.delete(conversations).where(eq(conversations.id, conversationId));`
- **What is wrong:** Archiving is per user, but delete removes the thread for both parties, and messages cascade.
- **Exploit / failure scenario:** One party erases the thread before a dispute.
- **Mitigating layers checked:** Only the participant check.
- **Real-world impact:** Cross-user loss of rental communications.
- **Recommended fix:** Add per-user `userNDeletedAt` soft deletes; hard-delete only when both users have deleted.
- **Tests needed:** A delete by user1 leaves the thread visible to user2.
- **Related:** none

### DB-04: The dispute financial ledger records deposit releases and skips as capture_deposit, and participants see them

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** DB-09

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High
- **Files:** `dispute-resolution-service.ts:164-176,598-611`; `dispute-financial.ts:330-339,359-368`; `participant-view.ts:287-293`; `_enums.ts:177-182`
- **Affected routes:** `/api/disputes/[id]/resolve`; GET `/api/disputes/[id]`
- **Relevant code:** the release branch writes `operationType: "capture_deposit", … status: "succeeded"` (`dispute-resolution-service.ts:605-610`).
- **What is wrong:** The enum has no release value. A release is stored as a succeeded capture, and each no-deposit resolution adds a failed capture. Participants see both rows.
- **Exploit / failure scenario:** On a `favor_renter` resolution, the renter sees "Capture Deposit — succeeded".
- **Mitigating layers checked:** None.
- **Real-world impact:** Both the audit trail and the UI misstate money movement.
- **Recommended fix:** `ALTER TYPE financial_operation_type ADD VALUE 'release_deposit'`, add a "skipped" value, and backfill.
- **Tests needed:** A release writes the new type.
- **Related:** CONC-09

## Verified clean (database auditor)

- **Required unique constraints exist:**
  - `rentals.request_id` (`rentals.schema.ts:140-143,188`)
  - `rpl_rental_id_idx`
  - `spl_booking_id_idx`
  - blind-review partial uniques plus the `num_nonnulls` check (`blind-reviews.schema.ts:43-54`)
  - dispute uniques plus the XOR check (`disputes.schema.ts:66-74`)
  - membership and one-primary partial uniques (`communities.schema.ts:100-105`)
  - category names
  - `neighborhood_need_listings`
- **One payment row per PaymentIntent:** not DB-enforced, but rows are written only after a claim (`rentals.dal.ts:1884-1902`, `service-booking.dal.ts:241-261`). Add `UNIQUE(stripe_payment_intent_id)` as defense in depth.
- **Compare-and-swap guards:**
  - service accept, complete and cancel (plans 009/011): `service-booking.dal.ts:175-203,241-261`
  - payout claims: `payment-lifecycle.dal.ts:246-266`, `service-payment-lifecycle.dal.ts:152-172`
  - expiry CAS results are checked: `expire-pending-bookings.ts:34-35,49-50`
- **Counters:**
  - SQL increments (`listing.dal.ts:394-399`, `payment-lifecycle.dal.ts:318-327`).
  - Review aggregates are recomputed from source (`user.dal.ts:1252-1276`).
- **Money columns and math:**
  - All money columns are `numeric(10,2)`.
  - Every cents conversion uses `Math.round` (`refund-calculations.ts:22-41`, `payout.ts:31`, `rental-payments.ts:38`, `service-payments.ts:138,170`).
- **Transactions and retries:**
  - All 3 transactions use `tx`, and none calls Stripe.
  - `createUserWithAddress` makes a geocoding HTTP call inside its transaction (`user.dal.ts:753-768`, LOW).
  - `withReadRetry` is used on reads only (`notifications.dal.ts:419,628`).
- **Ownership checks before PK-keyed writes:**
  - `listing-service.ts:60,308,347`
  - `listings/[listingId]/status/route.ts:60-71`
  - `neighborhood-needs-service.ts:118-121,151-155`
  - `service-listing-service.ts:414-417`
  - notifications are scoped by `userId` (`notifications.dal.ts:205-210`)
- **Input validation:** rating 1–5 (Zod) and end ≥ start (`rental-quote.ts:118-143`) are enforced server-side.
- **Unreachable or unused paths:**
  - `messages.rental_id` is never written, so its `NO ACTION` FK is inert.
  - `deleteCommunity` has no callers.
  - `overdue` and `payment_status.completed` are never written.
  - TS status unions derive from the pg enums (`dal/types.ts:555-569`).
- **Known follow-ups, still present, not re-reported:**
  - `approveRentalRequest` is not a transaction (`rentals.dal.ts:1985-2017`)
  - the approve vs renter-cancel race (`:1808-1847`)
  - `declineBooking` is unguarded (`service-booking-service.ts:616-620`)
  - notes PUT ordering

## Auditor open questions — database

1. Does prod contain a `user` row with `id='system'`? (BIZ-06)
2. What do prod's `drizzle.__drizzle_migrations` rows and the `legal_documents` PK look like, and has `db:push` ever been run against prod? (DB-02)
3. Payout crash followed by a reset: can a transfer succeed and then the function die before `updateOwnerTransferStatus`, leaving `processing`? If so, a reset ≥24h later re-sends `transfer-owner-{rentalId}`. Does idempotency-key expiry then allow a second transfer, or does the `source_transaction` cap block it? No cron route sets `maxDuration`.
4. Is delete-for-both on conversations intended? (DB-03)
5. Is `StripeDisputeService.createRefund` (`dispute-financial.ts:110-118`) reachable? It has no idempotency key and never updates `payments`.
6. The freeze and payout claim are not atomic at the 24h filing/payout boundary. The window is narrow (daily cron), and the BIZ-05/CONC-09 fixes cover it.
