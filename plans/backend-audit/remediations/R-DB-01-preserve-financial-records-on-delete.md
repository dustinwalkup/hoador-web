# R-DB-01: Preserve financial and legal records on listing/user delete

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/features/listings/services/listing-service.ts src/dal/listing.dal.ts src/db/schemas/payments.schema.ts src/db/schemas/rental-payment-lifecycle.schema.ts src/db/schemas/rental-agreement-documents.schema.ts src/db/schemas/legal-documents.schema.ts src/db/schemas/disputes.schema.ts "src/app/api/admin/users/[userId]/route.ts"`
> A mismatch against "Current state" below is a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED (a migration + a delete path)
- **Depends on**: none · **Category**: bug (data integrity) / migration
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`DELETE /api/listings/[listingId]` hard-deletes the row, and the FK chain
`listings → rental_requests → rentals → payments / rental_payment_lifecycle
/ rental_agreement_documents / user_legal_acceptances` is `ON DELETE
CASCADE` end to end. The delete guard blocks only pending/approved/active/
overdue rentals — a **completed** rental's payment record, payout lifecycle
row and signed agreement are silently destroyed by a routine owner delete,
while the Stripe-side charge and any live deposit hold stay exactly where
they were, now unreconcilable. It is also a dispute-evasion vector: deleting
the listing inside the 24h filing window erases the rental before a renter
can file. Superadmin user hard-delete has no guard at all and cascades the
same way via `payments.payer_id`/`payee_id`. Audit finding DB-01 (HIGH).

## Current state

- `listing-service.ts:317-378` `deleteListing` — guard is
  `rentalDAL.countInFlightRentalsForListing` (pending + approved/active/
  overdue only, per its own docstring at line 320-336: "Completed, cancelled
  and denied rentals do NOT block"); then `listingDAL.deleteListing(id)`.
- `listing.dal.ts:677-710` `deleteListing` — `this.db.delete(listings).where(eq(listings.id, id)).returning()`. Plain hard delete.
- `listing.dal.ts:1508-1520` already has the archive vocabulary this plan
  reuses: "Get archived listings owned by a user (`isActive = false`)" —
  `isActive` (boolean, default `true`) is a distinct field from the
  `status` enum (`available|rented|maintenance|inactive`); several existing
  queries filter `eq(listings.isActive, true)` for "not archived"
  (`listing.dal.ts:768,1112,1145,1167,1191,1211,1234,1254`).
- FK chain (all confirmed `onDelete: "cascade"` by direct read):
  `rentalRequests.listingId → listings.id` (`rentals.schema.ts:30-32`);
  `rentals.requestId → rentalRequests.id` (`:140-143`);
  `payments.rentalId → rentals.id` (`payments.schema.ts:22-24`);
  `rentalPaymentLifecycle.rentalId → rentals.id`
  (`rental-payment-lifecycle.schema.ts:23-25`);
  `rentalAgreementDocuments.rentalRequestId → rentalRequests.id`
  (`rental-agreement-documents.schema.ts:17-19` — keys off the **request**,
  not `rentals`); `userLegalAcceptances.rentalRequestId → rentalRequests.id`
  (`legal-documents.schema.ts:48-51`).
- `disputes.rentalId → rentals.id` is **already** `onDelete: "restrict"`
  (`disputes.schema.ts:35-37`) — do not change it; it is the existing
  mitigation the audit notes.
- `disputes.schema.ts:178-180` `disputeFinancialOperations.performedBy` — `text("performed_by").references(() => user.id, {onDelete:"set null"}).notNull()`. **NOT NULL with a SET NULL action** — Postgres cannot satisfy both when the referenced user is deleted; the statement errors.
- `admin/users/[userId]/route.ts:166-208` `deleteHandler` — superadmin-only
  (checked 175-181), then `userDAL.deleteUser(userId)` (line 186) with no
  money/history guard. `user.dal.ts:244-257` `deleteUser` is a plain
  `delete(user).where(eq(user.id,id))`.

```ts
// listing.dal.ts:685-688 — the hard delete
const result = await this.db
  .delete(listings)
  .where(eq(listings.id, id))
  .returning();
```

**Conventions**: mirror `R-BIZ-01`'s `handleApiError`-branch pattern if a new
error is needed. **SEC-16**: not relevant — no step here relies on catching
a pg error code.

## Commands

| Purpose            | Command                                                                                 | Expected                                                      |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Typecheck          | `bun run type-check`                                                                    | exit 0                                                        |
| Lint               | `bun run lint`                                                                          | exit 0                                                        |
| Generate migration | `bun run db:generate --custom --name=restrict_financial_record_fks`                     | scaffolds an empty numbered SQL file — review before applying |
| Local DB           | `docker compose up -d`, then `bun run db:migrate` against `.env.local`'s `DATABASE_URL` | applies cleanly                                               |
| Tests              | `bun run test:run src/features/listings src/dal/__tests__/listing.dal.test.ts`          | all pass                                                      |

## Scope

**In scope**: `listing-service.ts` (`deleteListing`), `listing.dal.ts`
(`deleteListing` + a new "has rental history" check), one migration file,
`admin/users/[userId]/route.ts` (`deleteHandler`), a new DAL check for user
money history, `disputes.schema.ts` (`performedBy` nullability), tests.

**Out of scope**: `DB-03`'s conversation-delete finding; `DB-02`'s migration-
history repair (do not attempt to fix migration 0015/0017 as part of this
plan — see STOP conditions); self-service account deletion (`R-BIZ-07`'s
territory).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Find the current FK constraint names

Before writing the migration, get the real names (drizzle's default
convention is `<table>_<column>_<reftable>_<refcol>_fk`, but confirm rather
than assume):
`grep -rn "payments_rental_id\|rental_payment_lifecycle_rental_id\|rental_agreement_documents_rental_request_id\|user_legal_acceptances_rental_request_id" src/db/migrations/*.sql`.
Record each exact name for Step 2.

### Step 2: Migration — RESTRICT the money/legal FKs, fix the NOT NULL/SET NULL conflict

Run the generate command from Commands, then write (using the real names
from Step 1 in place of `<name>`):

```sql
ALTER TABLE payments DROP CONSTRAINT <payments_rental_id_fk>,
  ADD CONSTRAINT <payments_rental_id_fk> FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE RESTRICT;
ALTER TABLE rental_payment_lifecycle DROP CONSTRAINT <rpl_rental_id_fk>,
  ADD CONSTRAINT <rpl_rental_id_fk> FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE RESTRICT;
ALTER TABLE rental_agreement_documents DROP CONSTRAINT <rad_rental_request_id_fk>,
  ADD CONSTRAINT <rad_rental_request_id_fk> FOREIGN KEY (rental_request_id) REFERENCES rental_requests(id) ON DELETE RESTRICT;
ALTER TABLE user_legal_acceptances DROP CONSTRAINT <ula_rental_request_id_fk>,
  ADD CONSTRAINT <ula_rental_request_id_fk> FOREIGN KEY (rental_request_id) REFERENCES rental_requests(id) ON DELETE RESTRICT;
ALTER TABLE dispute_financial_operations ALTER COLUMN performed_by DROP NOT NULL;
```

Update the four `onDelete` values in the corresponding `*.schema.ts` files
to `"restrict"` (drizzle's schema must match the DB, or the next
`db:generate` will try to revert it), and drop `.notNull()` from
`disputeFinancialOperations.performedBy` in `disputes.schema.ts:178-180`.

**Verify**: apply to the local DB (Commands); `bun run db:generate` afterward
produces **no** new pending migration (schema and DB agree).

### Step 3: Archive instead of hard-delete when a listing has rental history

In `listing.dal.ts`, add `async hasRentalHistory(listingId): Promise<boolean>`
— `SELECT 1 FROM rental_requests WHERE listing_id = $1 LIMIT 1` (any row,
any status — a request row itself is worth retaining once it exists, not
only completed ones). In `deleteListing` (the DAL method), branch: if
`hasRentalHistory` is true, `UPDATE listings SET is_active=false,
updated_at=now() WHERE id=$1` instead of deleting; else run the existing
hard delete unchanged (including its blob cleanup). Keep the method's
signature (`Promise<void>`) and the service's call site unchanged — the
route's response shape does not change either way.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Superadmin hard delete refuses users with money history

Add a DAL check, e.g. `paymentDAL.userHasPaymentHistory(userId): Promise<boolean>`
— `SELECT 1 FROM payments WHERE payer_id=$1 OR payee_id=$1 LIMIT 1`. In
`admin/users/[userId]/route.ts`'s `deleteHandler`, call it before
`userDAL.deleteUser` (before line 186); on `true`, return
`NextResponse.json({error: "This user has payment history and cannot be hard-deleted. Anonymize the account instead."}, {status: 409})`
without calling `deleteUser`.

**Verify**: `bun run type-check` → exit 0.

## Test plan

- **DAL**: deleting a listing with a completed rental (any `rental_requests`
  row present) sets `isActive=false` and does not delete the row; its
  `payments`/`rental_payment_lifecycle` rows are untouched. Deleting a
  listing with zero `rental_requests` still hard-deletes (existing
  behavior, blob cleanup included).
- **Route/admin**: superadmin DELETE on a user with a `payments` row → 409,
  `userDAL.deleteUser` NOT called (mock). A user with none → deletes as
  today.
- **Migration**: on the local DB, attempt
  `DELETE FROM rentals WHERE id = <one with a payments row>` directly in
  `psql` → expect a foreign-key-violation error (RESTRICT is live), not a
  cascade.

**Verify**: `bun run test:run src/features/listings src/dal/__tests__/listing.dal.test.ts` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0, including new cases above
- [ ] Migration applies cleanly; `bun run db:generate` afterward is a no-op
- [ ] Deleting a listing with any `rental_requests` history archives
      (`isActive=false`) instead of deleting the row
- [ ] Superadmin hard-delete on a user with `payments` history returns 409
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Live code doesn't match "Current state" (drift since `21bdc61`).
- Step 1 finds a constraint name pattern that doesn't match drizzle's
  default convention — report the actual names found rather than guessing.
- Applying the migration to the local DB fails because existing data
  already violates the new RESTRICT (i.e., some `rentals` row's referencing
  `payments`/lifecycle rows would have blocked a delete that already
  happened under the old CASCADE) — this cannot happen for a _new_
  constraint on existing rows (RESTRICT only blocks future deletes), but if
  `db:generate`/`migrate` reports any other error, stop and report it rather
  than loosening the constraint.
- Do **not** attempt to fix `DB-02`'s broken migration history (migration
  0015/0017 ordering) as part of this plan, even if it's tempting while
  touching migrations — out of scope, separate finding.

## Mobile compatibility

- `DELETE /api/listings/[listingId]`: response shape and status code are
  **unchanged** for both the archive and hard-delete branches — the service/
  route contract stays `void`/existing success response either way; the app
  cannot tell which branch ran from the response, only that the listing no
  longer appears as active (already true today when a listing is archived
  via the existing `isActive=false` "Archived" garage tab).
- `DELETE /api/admin/users/[userId]` (superadmin-only, not a
  mobile-consumer surface): new 409 `{"error": "..."}` on a user with
  payment history; no `code` field (single reason, admin-facing message is
  sufficient — mirrors the simple `ConflictError` shape, not the blocker-
  list shape used by `AccountDeletionBlockedError`).
- No changes to any rental/payment/agreement GET response shape.

## Maintenance notes

- If a listing is archived under this plan, nothing currently offers the
  owner an "un-archive" path from the garage UI for a listing that was
  deleted via this new branch versus one they archived themselves — same
  `isActive=false` state either way, so existing archive/restore UI (if any)
  applies unchanged; flag to product if a distinct "deleted" affordance is
  wanted later.
- `DB-02` (migration history) and `DB-03` (conversation hard-delete) are
  adjacent, unfixed findings in the same document — not addressed here.
