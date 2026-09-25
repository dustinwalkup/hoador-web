# Production cutover checklist

Everything the backend-audit fixes need done **by hand, outside the code**, when they first reach production: data cleanup before a migration, a migration that `drizzle-kit push` can't create, Stripe events to resend. Code review and CI can't catch any of these. hoador is not in production yet (2026-09-24), so each step below records how it went on dev and staging, so prod can repeat it.

**Executors: when your fix needs a manual step in any environment, add a row here in the same change,** as the roadmap's _Mobile client follow-ups_ table does for contract changes.

## Environments

| Env     | Neon host          | How to target it                                  |
| ------- | ------------------ | ------------------------------------------------- |
| dev     | `ep-lucky-block`   | uncomment its `DATABASE_URL` line in `.env.local` |
| staging | `ep-polished-tree` | uncomment its `DATABASE_URL` line in `.env.local` |
| prod    | _TBD_              | —                                                 |

`.env.local` holds both lines and one is commented out. **Check which host is live before every step** (`grep ^DATABASE_URL .env.local`). On 2026-09-24 a cleanup meant for staging ran against dev and matched nothing.

## Step status

| #   | Step                                                             | From          | dev                                   | staging                               | prod |
| --- | ---------------------------------------------------------------- | ------------- | ------------------------------------- | ------------------------------------- | ---- |
| B1  | Snapshot the database (Neon branch) before migrating             | —             | —                                     | —                                     | TODO |
| B2  | Run and triage the roadmap's ops checks 1–10                     | Phase 0       | moot                                  | moot                                  | TODO |
| B3  | Resolve overlapping bookings (before 0072)                       | R-CONC-01     | DONE 2026-09-24: 4 requests cancelled | DONE 2026-09-24: 4 requests cancelled | TODO |
| B4  | Mobile build that handles the new error codes is live            | R-SEC-01 etc. | n/a                                   | n/a                                   | TODO |
| M1  | `bun run db:migrate`                                             | all           | DONE 2026-09-24 (0069–0072)           | DONE 2026-09-24 (0072)                | TODO |
| M2  | `bun run db:migrate` for 0073 (RESTRICT money/legal FKs)         | R-DB-01       | DONE 2026-09-24                       | DONE 2026-09-24                       | TODO |
| M3  | `bun run db:migrate` for 0074 (`transfer_deposit` enum value)    | R-BIZ-04      | DONE 2026-09-24                       | DONE 2026-09-24                       | TODO |
| M4  | `bun run db:migrate` for 0075 (`rate_limit_buckets` table)       | R-ARCH-07     | DONE 2026-09-24                       | DONE 2026-09-24                       | TODO |
| M5  | `bun run db:migrate` for 0076 (per-user conversation delete)     | R-BIZ-09      | TODO                                  | TODO                                  | TODO |
| A1  | Verify `rental_requests_no_overlap` exists                       | R-CONC-01     | DONE                                  | DONE                                  | TODO |
| A2  | Resend failed `charge.dispute.created` webhooks (within 30 days) | R-BIZ-06      | n/a                                   | n/a                                   | TODO |
| A3  | Pay owners deposits captured before R-BIZ-04 (backfill)          | R-BIZ-04      | moot (no real captures)               | moot (no real captures)               | TODO |
| A4  | Scrub accounts deleted before R-PRIV-09 (optional)               | R-PRIV-09     | TODO (optional)                       | TODO (optional)                       | N/A  |

## Before deploying

**B1. Snapshot.** Create a Neon branch of prod first, so a bad migration or cleanup can be undone.

**B2. Ops checks.** See _Ops checks to run now_ in [10-remediation-roadmap.md](10-remediation-roadmap.md). Each check finds bad state left by an old bug: charged but not rented, paid out after a refund, and so on. They only find anything if real payments ran on the old code, but prod is where that happens, so run all ten and triage every hit in Stripe.

**B3. Overlapping bookings (R-CONC-01).** Migration 0072 adds an exclusion constraint, and it can't be created while two approved, active or overdue requests on one listing share a day. Find them:

```sql
SELECT a.id, a.status, a.start_date::date, a.end_date::date,
       b.id, b.status, b.start_date::date, b.end_date::date, a.listing_id
FROM rental_requests a JOIN rental_requests b
  ON a.listing_id = b.listing_id AND a.id < b.id
 AND a.status IN ('approved','active','overdue')
 AND b.status IN ('approved','active','overdue')
 AND a.start_date::date <= b.end_date::date
 AND a.end_date::date >= b.start_date::date
ORDER BY a.listing_id;
```

- On dev and staging these were seed data, so one side of each pair was set to `cancelled` with a bare `UPDATE`. **Don't do that in prod.** A prod row is a booking a renter paid for. Cancel it through the app's cancellation path, or refund it in Stripe and release any deposit hold before changing its status. Tell both parties.
- Cancel the fewest rows that clear every pair. One request that overlaps two others clears both pairs at once.
- Zero rows is the expected result if CONC-01 deploys before real traffic.

**B4. Mobile first.** Fixes that add a new error `code` need a shipped app that handles it. See the roadmap's _Mobile client follow-ups_ table. R-SEC-01's 403 codes must at least sign the user out cleanly.

## Deploying

**M1. Migrate.** `bun run db:migrate`, after checking the host. drizzle-kit runs **every pending migration in one transaction**, so one failure rolls back the whole batch, and the plain output hides the Postgres error. If it fails, rerun with `npx drizzle-kit migrate --verbose`. The migrations the audit fixes depend on:

| Migration                                | Fix       | Notes                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0070_seed_system_user`                  | R-BIZ-06  | Idempotent (`ON CONFLICT DO NOTHING`). Nothing to prepare.                                                                                                                                                                                                                                                       |
| `0072_rental_requests_no_overlap`        | R-CONC-01 | Needs B3 first. Installs `btree_gist`. Not in the Drizzle schema (see below).                                                                                                                                                                                                                                    |
| `0073_restrict_financial_record_fks`     | R-DB-01   | No data prep: it only changes FK delete actions and drops NOT NULL on `dispute_financial_operations.performed_by`. Postgres truncates one constraint name to 63 chars (`rental_agreement_documents_rental_request_id_rental_requests_id`) and prints a NOTICE when the migration refers to it; that is expected. |
| `0074_add_transfer_deposit_financial_op` | R-BIZ-04  | No data prep. A single `ALTER TYPE ... ADD VALUE`.                                                                                                                                                                                                                                                               |
| `0076_conversation_per_user_delete`      | R-BIZ-09  | No data prep: two nullable `ADD COLUMN`s on `conversations`. Existing rows read as `NULL`, meaning "not deleted" for either party.                                                                                                                                                                               |

## After deploying

**A1. Verify the constraint.**

```sql
SELECT conname FROM pg_constraint WHERE conname = 'rental_requests_no_overlap';
```

**A2. Resend chargebacks (R-BIZ-06).** Before the fix, every `charge.dispute.created` webhook failed on the missing `system` user. List `audit_logs` rows with `action = 'webhook.failed'` whose metadata `eventType` is `charge.dispute.created` (ops check 5), then resend those events from Stripe → Developers → Events. **Stripe keeps events for 30 days only**, so do this as soon as the fix is live.

**A3. Captured-deposit backfill (R-BIZ-04).** From deploy on, a deposit captured in a dispute is transferred to the owner automatically. Deposits captured **before** deploy never were. Find them. The `NOT EXISTS` checks for a _succeeded_ transfer, because a failed attempt leaves a `failed` row:

```sql
SELECT dfo.dispute_id, dfo.amount, dfo.stripe_payment_intent_id, d.rental_id
FROM dispute_financial_operations dfo
JOIN disputes d ON d.id = dfo.dispute_id
WHERE dfo.operation_type = 'capture_deposit'
  AND dfo.status = 'succeeded'
  -- A deposit RELEASE is also recorded as a succeeded capture_deposit; only a
  -- real capture sets stripe_operation_id, and only these outcomes capture.
  AND dfo.stripe_operation_id IS NOT NULL
  AND d.resolution_outcome IN ('favor_provider','partial_provider','partial_renter')
  AND NOT EXISTS (
    SELECT 1 FROM dispute_financial_operations t
    WHERE t.dispute_id = dfo.dispute_id
      AND t.operation_type = 'transfer_deposit'
      AND t.status = 'succeeded');
```

A full capture records no `amount`, so take the captured amount from the PaymentIntent in Stripe (`amount_received`). Transfer all of it to the owner's Connect account (there's no platform fee on deposits, decided 2026-09-24), with `source_transaction` set to the deposit's charge. Record a `transfer_deposit` row with the transfer id. Do it one row at a time, with sign-off; don't bulk-automate.

The same query also finds **live failures** after deploy: each `deposit_transfer_failed` ops alert leaves a `failed` row. A retry must use a new idempotency key (`deposit-transfer-{disputeId}-retry-{n}`, via `createDepositTransfer`'s `retryCount`), because Stripe replays a cached failure for a reused key. A `deposit_transfer_unrecorded` alert means the owner **was** paid and only the row is missing. Add the row and don't pay again.

**A4. Accounts deleted before R-PRIV-09 (dev/staging only).** Self-deletion now deletes the user's uploaded blobs and clears leftover PII: delivery details, messages and ad attribution on their rental requests, activity-log IPs, and push rows. Accounts deleted before the fix still have all of that. Prod has none (it launches with the fix), so this is N/A there. On dev/staging these are test accounts, so marking the step N/A is reasonable. Count them first (name the host: dev = `ep-lucky-block`, staging = `ep-polished-tree`):

```sql
SELECT count(*) FROM "user" WHERE anonymized_at IS NOT NULL;
```

If the leftovers matter, **don't just call `anonymizeUser` again**: nobody has checked that it's safe to re-run on an already-anonymized row, and the blob deletes live in the service, not the DAL. Write a one-off script that runs the PRIV-09 statements from `anonymizeUser` and the service's blob helpers for `WHERE anonymized_at IS NOT NULL`.

## Standing rules

- **Never run `drizzle-kit push` against staging or prod.** `rental_requests_no_overlap` exists only in migration 0072's SQL, not in the Drizzle schema. Push leaves an existing constraint alone (verified 2026-09-24) but never creates it. A database built with push (the local e2e DB, a fresh Neon branch) is missing it until you run the 0072 SQL by hand.
- **Never run the dev seeds against prod.** They were fixed to respect the constraint, but `rentals.seed.ts` only avoids clashes within its own batch, not with rows already in the database.

## Known follow-ups (not blocking, but prod-relevant)

- ~~The admin delete doesn't guard the `system` user~~ — fixed in R-DB-01 (409). It still shows in the admin user list.
- **Behavior change to expect after R-PRIV-09:** a deleted account's push rows are gone, not `is_active = false`. Its listings are archived (`is_active = false`) with no images, and its closed-dispute evidence photos become the text `[Photo removed — account deleted]`. Watch for the ops alerts `account_deletion_blob_delete_failed` (a blob is still public; delete it by hand) and `account_deletion_open_dispute_evidence_retained` (should never fire; it means `getDeletionBlockers` let a user with an open dispute through).
- **Behavior change to expect after R-DB-01:** deleting a listing that ever had a rental request archives it (`is_active = false`), and it shows in the owner's Archived tab. Superadmin hard-delete of a user with payments or rental requests returns 409, so those accounts can only be suspended or deactivated.
