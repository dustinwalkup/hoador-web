# R-BIZ-06: Seed a system user so chargeback auto-disputes can be created

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/services/stripe/chargeback-service.ts src/db/schemas/user.schema.ts src/db/schemas/disputes.schema.ts src/db/schemas/_enums.ts`
> If any in-scope file changed, compare "Current state" against live code
> before proceeding; a mismatch is a STOP condition.

## Status

- **Priority**: P0 · **Effort**: S · **Risk**: LOW
- **Depends on**: none · **Category**: bug / migration
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

When a bank chargeback arrives on a rental or service booking with no
existing internal dispute, `ChargebackService` inserts an auto-dispute with
`createdBy: "system"`. `disputes.created_by` is `text NOT NULL REFERENCES
user.id`, and **no migration or seed ever creates a `system` user** — so the
insert fails with a foreign-key violation before the payout freeze and before
the ops alert both run (they're coded _after_ the insert). The webhook
handler catches the throw, logs a `webhook.failed` audit row, and returns
500; Stripe retries the same event for up to 3 days, failing identically each
time. Net effect: on a live, un-tracked chargeback, the platform never
freezes the payout and never alerts ops — the cron can pay the counterparty
while the chargeback is still open. Audit finding BIZ-06 (HIGH), gap TEST-06.

## Current state

- `src/services/stripe/chargeback-service.ts` (full file, 375 lines),
  `handleChargebackCreated` — both branches hardcode the same literal:

```ts
// :99-107, service booking branch
const autoDispute = await disputeDAL.create({
  rentalId: null, serviceBookingId, createdBy: "system",
  createdByRole: "requester", reasonCode: "payment_issue", ...
});
// :176-183, rental branch (same literal)
const autoDispute = await disputeDAL.create({
  rentalId, createdBy: "system", createdByRole: "renter", ...
});
```

`servicePaymentLifecycleDAL.freezeForDispute(serviceBookingId)` /
`paymentLifecycleDAL.freezeForDispute(rentalId)` run at lines 125 / 201 —
**after** the insert — and the `chargeback_created` `sendOpsAlert` runs
right after that. A thrown insert skips both.

- `disputes.schema.ts:42-44` —
  `createdBy: text("created_by").references(() => user.id, {onDelete:"cascade"}).notNull()`.
  `src/db/migrations/0016_wild_tigra.sql:89` —
  `ALTER TABLE "disputes" ADD CONSTRAINT "disputes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id")...`.
  Confirmed: no migration, seed, or app code anywhere creates a `user` row
  with `id = 'system'`.
- `user.schema.ts:35-104` — the only `NOT NULL` columns without a default are
  `id`, `name`, `email` (unique). Every other column defaults
  (`status` → `'pending_verification'`, `userType` → `'standard'`,
  `emailVerified` → `false`, etc.). `userStatusEnum` (`_enums.ts:3-10`)
  includes `"inactive"`. `account`/`session` rows are separate tables — a
  `user` row with none can never authenticate via better-auth.
- `base.ts:15-67` `handleError` — confirmed: `error.code` is checked against
  raw pg codes (`23505`/`23503`/`23514`), but drizzle-orm 0.45 wraps driver
  errors in `DrizzleQueryError` with the pg code on `.cause`, so these checks
  never match (SEC-16). Today's FK violation therefore surfaces as the
  generic `DATABASE_ERROR` 500 at line 62-66, not a typed 400/409 — this
  plan doesn't touch `handleError`; it just explains why the failure is an
  opaque 500 today, and confirms the fix (make the insert succeed) doesn't
  depend on fixing SEC-16 separately.
- `webhook-handlers.ts:75-98` — on any handler throw, writes
  `auditLogDAL.create({entityType:"webhook", entityId: event.id, action:"webhook.failed", metadata:{eventType, error}})`,
  then rethrows (500, Stripe retries). This is the backfill target (Step 4).

## Commands

| Purpose        | Command                                                | Expected                                           |
| -------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Typecheck      | `bun run type-check`                                   | exit 0                                             |
| Lint           | `bun run lint`                                         | exit 0                                             |
| DB diff        | `bun run db:generate --custom --name=seed_system_user` | creates an empty migration file to fill in by hand |
| Targeted tests | `bun run test:run src/services/stripe`                 | all pass                                           |
| Full tests     | `bun run test:run`                                     | all pass                                           |

## Scope

**In scope**: one new migration file under `src/db/migrations/` (+ its
`meta/_journal.json` entry if `db:generate --custom` doesn't add it
automatically — verify), `src/services/stripe/chargeback-service.ts`
(reorder the ops alert only, per Step 3), tests for the chargeback service.

**Out of scope**: `disputes_rental_id_unique`'s non-partial-index issue (a
second, related defect the audit notes but this finding doesn't ask to fix —
do not touch); `BaseDAL.handleError`/SEC-16 (separate finding, no plan
assigned here); any admin user-list UI (see Step 2 — note only, don't build).

## Git workflow

Work on `develop`. Do NOT commit or push — leave changes uncommitted.

## Steps

### Step 1: Seed the system user

Create the migration (via `bun run db:generate --custom --name=seed_system_user`,
or by hand as `src/db/migrations/00NN_seed_system_user.sql` — increment `NN`
from the highest existing file in that directory, and add a matching entry to
`src/db/migrations/meta/_journal.json` copying the shape of the last entry
with `idx` incremented, if the `--custom` flag doesn't do this for you). SQL:

```sql
INSERT INTO "user" (id, name, email, status, user_type, email_verified)
VALUES ('system', 'System', 'system@invalid.hoador', 'inactive', 'standard', false)
ON CONFLICT (id) DO NOTHING;
```

`ON CONFLICT (id) DO NOTHING` makes this safe to run against a production DB
that might already have a hand-created row with this id. Do **not** insert
any `account` row — that's what keeps this user unable to sign in.
**Verify**: `bun run db:generate` (or `db:migrate` if you have a local DB
connection per `.env.local` — do not attempt this without one) shows no
further pending schema diff; inspect the migration file's SQL matches above.

### Step 2: Note the admin-list exposure, don't fix it

Grep for an obvious place `id='system'` would leak into a user-facing list:
`grep -rln "userDAL.getAllUsers\|admin.*users.*list\|getUserList" src/app/api/admin src/features/admin 2>/dev/null`.
If nothing obviously unfiltered turns up, do nothing further — this is
explicitly a "note, don't over-engineer" item per the audit. If something
obvious does turn up (e.g. an admin "all users" table with no filter), add
one line noting it in this plan's Maintenance notes rather than editing that
UI — out of scope for a HIGH/P0 money-correctness fix.

### Step 3: Make the ops alert unmissable even on a future insert failure

In `chargeback-service.ts`, wrap each `disputeDAL.create(...)` call (both
branches) so that if it throws, an ops alert still fires before the error
propagates:

```ts
const { data: autoDispute, error: createError } = await tryCatch(
  disputeDAL.create({
    /* unchanged args */
  }),
);
if (createError) {
  await sendOpsAlert({
    event: "chargeback_auto_dispute_create_failed",
    rentalId: rentalId ?? "unknown", // or serviceBookingId in that branch
    message: `Failed to auto-create dispute for chargeback ${stripeDisputeId}: ${createError.message}`,
    metadata: { stripeDisputeId, chargeId },
    sendEmailAlert: true,
  }).catch(() => {});
  throw createError; // preserve today's 500 + Stripe-retry behavior
}
```

Use the `tryCatch` import already used elsewhere in this codebase
(`@walkup/walkup-utils`) — confirm it's importable here with
`grep -n "^import" src/services/stripe/chargeback-service.ts`. This is
defense-in-depth: Step 1 makes the _current_ failure mode (missing system
user) go away, but any _future_ insert failure (DB outage, a new NOT NULL
column, etc.) must still alert, per the plan's own mandate that "a future
failure must never be silent." **Verify**: `bun run type-check` → exit 0.

### Step 4: Backfill (manual — describe only)

No code. See Maintenance notes for the query and the manual replay step.

## Test plan

- **Real-DB insert test** (needs `R-TEST-HARNESS`; if that harness doesn't
  exist yet in this repo, write the test but guard it with
  `describe.skipIf(!process.env.TEST_DATABASE_URL)` or an equivalent skip and
  leave a `// TODO(R-TEST-HARNESS)` comment — do not invent a fake DB mock
  for this specific assertion, since the whole point is proving a _real_
  constraint is satisfied): after the migration runs,
  `disputeDAL.create({..., createdBy: "system", ...})` for both a rental and
  a service-booking dispute succeeds and returns a row whose
  `createdByUser.id === "system"`.
- **Unit test** (`chargeback-service.test.ts`, extends the existing mocked-DAL
  suite): mock `disputeDAL.create` to reject; assert `sendOpsAlert` is called
  with `event: "chargeback_auto_dispute_create_failed"` **before** the
  rejection propagates, and that `freezeForDispute` is never called for that
  path (unchanged from today, still correct — freeze only makes sense once a
  dispute row exists). Update the existing test at `chargeback-service.test.ts:118`
  (per the audit: it currently pins `createdBy: "system"` as a bare
  assertion) to also assert the row is a valid actor post-migration, or leave
  it as a literal-value pin if it already only checks the call args.

**Verify**: `bun run test:run src/services/stripe` → all pass, new cases included.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0; new tests above exist and pass
- [ ] The new migration file exists, is reviewed, and matches Step 1's SQL
- [ ] A test (real-DB or explicitly skip-marked pending `R-TEST-HARNESS`) proves the FK is satisfied
- [ ] A test proves `sendOpsAlert` fires even when the dispute insert throws
- [ ] No files outside Scope modified (`git status`)

## STOP conditions

- Excerpts above don't match live code (drift since `21bdc61`).
- `bun run db:generate --custom` isn't supported by the installed drizzle-kit
  version — hand-write the migration file and journal entry instead; if the
  journal format has changed from the example above, match the newest
  existing entry's shape exactly rather than guessing.
- A production `user` row with `id = 'system'` is discovered to already exist
  with different column values than this migration would set — the
  `ON CONFLICT DO NOTHING` makes this safe either way, but report it.
- Any step's test fails twice after a reasonable fix attempt.

## Mobile compatibility

- No API shape change. The chargeback webhook (`POST /api/stripe/webhooks`)
  is server-to-server only — never called by the mobile app.
- Indirect effect: disputes auto-created from a chargeback will now actually
  exist and appear in a party's dispute list/detail screens (they were
  silently failing before). `createdByRole` on these rows is `"requester"`
  or `"renter"` (the counterparty, not literally "system") — mobile's
  dispute UI already renders `createdByRole`, not the raw `createdBy` user
  id, so no client change is implied. If any screen ever renders
  `createdByUser.name`, it will show `"System"` for these rows — acceptable
  and arguably clearer than the current silent failure.

## Maintenance notes

- **Backfill** for chargebacks that failed before this migration landed (run
  by hand, no code): `SELECT entity_id AS stripe_event_id, metadata FROM audit_logs WHERE action = 'webhook.failed' AND metadata->>'eventType' = 'charge.dispute.created' ORDER BY created_at`
  — for each `stripe_event_id`, resend the event from the Stripe Dashboard
  (Developers → Webhooks → event → "Resend") or `stripe events resend
<id>` via the Stripe CLI, **after** this migration is deployed. Confirm
  each resend results in a `webhook.processed` audit row before moving to
  the next.
- If Hoador later adds a "resend failed webhooks" admin tool, this backfill
  query is its filter.
- The `disputes_rental_id_unique`/`disputes_service_booking_id_unique`
  indexes are full, not partial — a chargeback on a rental with a _closed_
  dispute will still hit a 23505 unique violation (a related but distinct
  defect the audit notes; not fixed by this plan).
- **Admin user list exposure (Step 2, noted only)**: the plan's grep found
  nothing, but `GET /api/admin/users` → `userDAL.getUsersForAdmin` has no
  filter, so the `system` user will show up in the admin user list. Worse,
  `disputes.created_by` is `ON DELETE CASCADE`, so a superadmin deleting that
  user (`DELETE /api/admin/users/[userId]` → `userDAL.deleteUser`) would delete
  every chargeback auto-dispute with it. A later fix should exclude or protect
  `id = 'system'` there.
- **Tests**: `src/services/stripe/__tests__/chargeback-system-user.integration.test.ts`
  runs the migration's own SQL, since the integration setup truncates `user`
  before each test and `db:push:e2e` doesn't run data migrations.
- **Deploy timing (2026-09-24)**: prod deploy is deferred. Stripe keeps
  events for 30 days, so any `charge.dispute.created` event older than that
  at deploy time can't be resent. At deploy, cross-check Stripe → Disputes
  and handle those by hand (create the dispute, freeze the payout). Until
  deploy, prod chargebacks neither freeze payouts nor alert ops, so watch
  Stripe's own dispute emails. The prod `system`-row check was waived (none on
  staging/local, and `ON CONFLICT DO NOTHING` covers it).
