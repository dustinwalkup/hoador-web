# Plan R-ARCH-04: Durable Postgres job queue for fan-outs and PDFs, plus a daily Stripe↔DB reconciliation cron

> **Executor instructions**: Follow this plan part by part and step by step.
> Run every verification command and confirm the expected result before
> moving on. If anything in "STOP conditions" occurs, stop and report — do
> not improvise.
>
> **Drift check (run first, from `hoador-web`)**:
> `git diff --stat 29fe557..HEAD -- src/db/schemas/_enums.ts src/db/schemas/index.ts src/dal/index.ts src/dal/payment-lifecycle.dal.ts src/features/admin/services/payment-lifecycle-admin-service.ts src/features/neighborhood-needs/services/neighborhood-needs-service.ts src/features/rentals/services/rental-service.ts src/features/services/services/service-booking-service.ts src/services/stripe/payout.ts .github/workflows/cron-jobs.yml src/test/integration/setup.ts`
> On any change, compare "Current state" against the live files before
> proceeding; a mismatch is a STOP condition. Diffs from R-BIZ-14 and
> R-CONC-04 in `payment-lifecycle.dal.ts`, `_enums.ts` and
> `payment-lifecycle-service.ts` are expected (see Landing order). Re-read
> them rather than stopping.

## Status

- **Priority**: P2 · **Effort**: L · **Risk**: MED
- **Depends on**: none functionally, but touches files R-PERF-05 already
  changed (`cron-jobs.yml`, `payment-lifecycle-service.ts`) and DB-02 for
  migration numbering — see Decision 4. **Landing order (review
  2026-09-25):** Parts A–C any time after DB-02. Parts D and E **after
  [R-BIZ-14](R-BIZ-14-webhook-and-stripe-failure-handling.md) and
  [R-CONC-04](R-CONC-04-freeze-aware-payouts-and-chargeback-after-payout.md)**,
  because D's rules read `partially_refunded` (BIZ-14) and `reversed`
  (CONC-04), and E's guard composes with CONC-04's `transfer.reversed`
  mapping. If D lands earlier, use the "before" variants written into Step
  D2 and revisit when those plans land.
- **Category**: architecture / reliability
- **Planned at**: commit `29fe557`, 2026-09-25
- **Fixes**: ARCH-04 (medium-term half — R-PERF-05 already did the
  short-term half: independent cron steps, hourly payouts, `maxDuration`,
  claim-first deposit holds); BIZ-11 (the payout-retry/idempotency half only
  — "payout re-drives after 24h or after admin resets can repeat a succeeded
  transfer"). BIZ-11's other half (indeterminate charge failures recorded as
  declines, enabling a double **charge**) is fixed in
  [R-BIZ-14](R-BIZ-14-webhook-and-stripe-failure-handling.md), not here — see
  Decision 5.

## Why this matters

Three unrelated gaps share one root cause: nothing in this codebase retries
failed background work.

- **Need fan-out and PDF generation run in `after()` with no retry.**
  `fanOutNewNeed` (notifications for a new Neighborhood Need) and both
  agreement-PDF triggers are fire-and-forget: a transient error —a Neon
  blip, a cold-start timeout on the PDF route, a dropped `fetch`— is caught,
  logged to Sentry as non-critical, and the work is gone. A renter can be
  charged and never receive their rental agreement PDF, silently, with
  nothing surfacing it as an incident. R-PERF-02 already fixed
  `fanOutNewNeed`'s **query cost**; its durability was never in scope there.
- **Nothing compares Stripe's ledger to ours.** A succeeded charge with no
  `payments` row, a transfer Stripe made that never got written to
  `rental_payment_lifecycle`, or a refund that landed differently than
  recorded are each either silently audit-logged or (at best) alerted once
  and forgotten. There is no periodic check that would catch drift
  accumulating over weeks.
- **An admin's transfer-status reset can repeat a successful transfer**
  (BIZ-11, second half). `resetTransferStatus` only fires from
  `ownerTransferStatus = 'failed'` and bumps `ownerTransferRetryCount`,
  producing a new Stripe idempotency key (`transfer-owner-{rentalId}-retry-{n}`).
  If the original transfer's Stripe call actually succeeded despite the
  network error that made us record `'failed'` (the same "indeterminate
  outcome" class BIZ-11 describes for charges), the retry is a second,
  distinct transfer — not deduplicated by Stripe, since the idempotency key
  changed on purpose.

## Current state

- `src/features/neighborhood-needs/services/neighborhood-needs-service.ts:83-90`
  — `createNeed` calls `fanOutNewNeed` inside `after()`, `.catch(captureNonCriticalError)`.
  `fanOutNewNeed` itself (`:319-383`) is already query-cheap post-R-PERF-02
  (one bulk INSERT…SELECT, one join, one batched Expo send) — this plan
  changes none of that logic, only where and how reliably it runs.
- `src/features/rentals/services/rental-service.ts:1044-1078` — inside the
  approval's `after()` block, a `fetch()` to
  `/api/internal/generate-rental-agreement` with a bearer secret and a 30s
  client-side abort; failure is `captureNonCriticalError` only.
  `src/features/services/services/service-booking-service.ts:588-621` does
  the identical thing for `/api/internal/generate-service-agreement`. Both
  internal routes (`src/app/api/internal/generate-{rental,service}-agreement/route.ts`)
  have exactly one caller each (confirmed:
  `grep -rln "generate-rental-agreement\|generate-service-agreement" src --include="*.ts" --include="*.tsx"`
  → only the route file and its one caller, no admin "resend" feature) and
  both call an exported generator directly:
  `generateAndStoreRentalAgreement` (`src/services/playwright/generate-rental-agreements/index.ts`)
  and `generateAndStoreServiceAgreement`
  (`src/services/playwright/generate-service-agreements/index.ts`).
- **No Stripe↔DB reconciliation exists at all.** `webhook-handlers.ts:134-175`
  `handlePaymentIntentSucceeded` only `getLogger().warn`s (not an ops alert)
  on an unmatched succeeded PaymentIntent, by design — the comment there
  notes the rental-approve write can legitimately race the webhook, so
  alerting immediately would be noisy. That's correct for "just happened";
  nothing checks again later for "still unmatched after a day," which is
  what a mismatch actually looks like.
- `src/features/admin/services/payment-lifecycle-admin-service.ts:99-137`
  `resetTransferStatus` — reads `ownerTransferStatus`, requires `'failed'`,
  then unconditionally calls `updateOwnerTransferStatus(rentalId, "pending")`
  and `incrementOwnerTransferRetryCount(rentalId)`. No Stripe lookup of any
  kind before allowing the reset.
- `src/services/stripe/payout.ts:26-51` `createOwnerTransfer` — deterministic
  key `transfer-owner-{rentalId}` (`-retry-{n}` after a reset), amount =
  `ownerPayoutAmount`, `source_transaction: rentalChargeId`,
  `destination: ownerConnectedAccountId`. Stripe's own per-source-charge cap
  (cumulative `source_transaction` transfers ≤ the charge amount) is the only
  existing backstop, and it's a hard Stripe error, not something this app
  detects proactively (concurrency findings, Open question 2).
- `src/features/admin/services/stale-processing-detection-service.ts` — the
  existing pattern this plan's Part D reconciliation job and Part A's worker
  both follow: a service function that queries, and on any hit calls
  `sendOpsAlert` **once** with a summary and a list of ids (never one alert
  per row), then a thin cron route that wraps it with `verifyCronSecret`,
  `CronRunHistoryService.recordRun`, and `maxDuration`.
- `.github/workflows/cron-jobs.yml` — three jobs (`hourly` `0 * * * *`,
  `daily` `0 10 * * *`, `cleanup` `0 13 * * *`), each `continue-on-error`
  per step with a final "Check job status" step, and its own
  `concurrency: { group: cron-${{ github.job }}, cancel-in-progress: false }`
  (R-PERF-05). This plan adds a fourth job and one step to `daily`.
- `src/test/integration/setup.ts:15-31` `TRUNCATE_LIST` — the real-DB test
  harness's own truncate list; a new table needs an entry here (same
  reasoning as `rate_limit_buckets`: no FK from anything else, so `CASCADE`
  never reaches it).
- `src/db/migrations/` — latest is `0077_deposit_hold_placing.sql`. Per the
  cross-plan decision, **DB-02 lands first in Phase 2** and squashes the
  migration baseline; take the next free number after DB-02's baseline
  (`0078` as of this writing — confirm with `ls src/db/migrations` before
  generating).

## Decisions for the maintainer

**1. One plan file, five independently landable parts — not five plan
files.** All five pieces below share one root cause (ARCH-04) and the first
two genuinely depend on Part A's table; splitting into separate `R-ARCH-04a/b/c`
files would mean re-deriving the same "Current state" and repeating the
migration-numbering caveat in each. **Recommendation: keep this as one
document, land the parts in order (A, then B/C any order, D and E anywhere
after A — D and E don't touch the job table at all), and commit/PR each part
separately** so a bad part doesn't block the others. Steps below are grouped
by part for exactly this reason.

**2. What moves onto the queue, and what deliberately doesn't.** The
roadmap's step outline says "fan-outs, PDF generation and payout batches."
This plan moves the first two (Parts B, C) and **leaves the payout crons
alone**. They already have everything a queue would give them:
`claimForProcessing`/`findEligibleForPayout` (a DB-level claim), deterministic
Stripe idempotency keys, hourly cadence and per-row `continue`-on-failure
(R-PERF-05). A generic worker's retry model — re-run the whole job on any
throw — is wrong for a payout row that partially succeeded (e.g., deposit
released, transfer not yet attempted): the _existing_ per-row loop in
`PaymentLifecycleService.processPayouts` already handles that correctly by
constrution (each Stripe call is separately guarded and every exit path
writes a terminal status); wrapping the batch as "one job" would either
re-run already-succeeded Stripe calls with the same idempotency key (a no-op,
harmless) or, worse, invite a future maintainer to add retry logic on top
that reintroduces the multi-transfer risk this plan's Part E is closing.
**Recommendation: don't migrate payout crons in this pass.** Revisit only if
a concrete failure mode shows the current per-row loop insufficient.

**3. Worker cadence — a new 5-minute cron, not the hourly job.** Fan-out and
PDF generation are user-visible within seconds today; moving them to the
existing `hourly` cadence would turn "your rental agreement is ready" into
"ready within the hour," a regression. **Recommendation: a dedicated
`jobs` GitHub Actions schedule at `*/5 * * * *`,** plus a best-effort
immediate "kick" (a fire-and-forget `fetch` to the worker route, inside
`after()`, ignoring its result) right after enqueueing — so the common case
still runs in seconds, and the 5-minute cron is the durability backstop for
when the kick doesn't land (function killed before the `fetch`, cold start,
etc.), not the primary delivery path. Steps assume this.

**4. Migration numbering.** This plan's migration (`jobs` table + `job_status`
enum) has no dependency on DB-02's content, but DB-02 changes what "the next
free number" means. If DB-02 has landed by the time this plan is executed,
generate against its baseline; if not, generate against `0077`. Either way,
run `bun run db:generate` and read the resulting filename — never hardcode a
number in code.

**5. BIZ-11 split — say where each half went.** "Indeterminate Stripe
failures recorded as declines and retried under new idempotency keys
(possible double **charge**)" is fixed in R-BIZ-14 (it's a per-attempt
classification fix inside `rental-service.ts`/`service-booking-service.ts`,
nothing to do with a queue). "Payout re-drives … can repeat a succeeded
**transfer**" is fixed here, in Part E, because the fix is a lookup against
Stripe's transfer list — the same lookup Part D's reconciliation job needs,
so they share one helper.

**6. Reconciliation window and cadence — daily, T-24h to T-48h lookback, one
summary alert.** Real-time reconciliation would fight the legitimate
webhook-races-the-write-path case the existing code already comments on
(`webhook-handlers.ts:144`). A daily job over a `[now-48h, now-24h)` window
gives every legitimate in-flight write time to land before it's judged
missing, matches the existing crons' daily cadence, and (per
`stale-processing-detection-service.ts`'s pattern) sends **one** alert with
counts and id lists rather than one per mismatch.

**7. Part E when Stripe can't be reached: fail closed.** (Added in review
2026-09-25; the draft failed open.) `resetTransferStatus` is a manual,
non-urgent admin action. The case Part E exists for, an original transfer
that succeeded despite a local error, is most likely during exactly the
Stripe trouble that would make the lookup fail. Failing open there re-opens
the double transfer. Refusing costs the admin a retry a few minutes later.
**Recommendation: fail closed.** Throw a `ValidationError` ("Couldn't check
Stripe for an existing transfer — try again shortly") and capture the
error. Step E1 assumes this.

## Commands you will need

| Purpose            | Command                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| Install            | `bun install`                                                                       |
| Typecheck          | `bun run type-check`                                                                |
| Lint               | `bun run lint`                                                                      |
| Generate migration | `bun run db:generate`                                                               |
| Targeted tests     | `bun run test:run <path>`                                                           |
| Real-DB tests      | `docker compose up -d && bun run db:push:e2e && bun run test:integration`           |
| YAML syntax check  | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"` |

## Scope

**In scope**: `src/db/schemas/_enums.ts`, `src/db/schemas/jobs.schema.ts`
(new), `src/db/schemas/index.ts`, one migration; `src/dal/jobs.dal.ts` (new),
`src/dal/index.ts`; `src/features/jobs/` (new directory: `job-types.ts`,
`job-runner.ts`, `handlers/index.ts`, `handlers/need-fan-out-handler.ts`,
`handlers/rental-agreement-pdf-handler.ts`,
`handlers/service-agreement-pdf-handler.ts`); `src/app/api/cron/run-jobs/route.ts`
(new); `src/features/neighborhood-needs/services/neighborhood-needs-service.ts`;
`src/features/rentals/services/rental-service.ts`;
`src/features/services/services/service-booking-service.ts`;
`.github/workflows/cron-jobs.yml`; `src/test/integration/setup.ts`;
`src/services/stripe/payout.ts` (new `findTransfersForCharge` helper);
`src/features/admin/services/stripe-reconciliation-service.ts` (new);
`src/app/api/cron/reconcile-stripe/route.ts` (new);
`src/features/admin/services/payment-lifecycle-admin-service.ts`; tests for
all of the above.

**Out of scope**: payout/deposit-hold crons (Decision 2); BIZ-13
(chargeback-after-payout — Phase 2 step 3, a different plan); BIZ-11's charge
half (R-BIZ-14); the internal PDF-generation HTTP routes' own code (left
alone — orphaned, not deleted, see Maintenance notes); any change to
`fanOutNewNeed`'s or the PDF generators' internal logic — only where they're
invoked from changes.

## Git workflow

Work directly on `develop`. Do not commit — leave changes uncommitted.

## Part A — The job table and worker

### Step A1: `job_status` enum, `jobs` table, migration

In `src/db/schemas/_enums.ts`, add:

```ts
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "processing",
  "succeeded",
  "failed", // will retry — run_at is in the future
  "dead_letter", // exhausted max_attempts; needs a human
]);
```

New `src/db/schemas/jobs.schema.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { jobStatusEnum } from "./_enums";

/**
 * Durable background-job queue (ARCH-04). One row per unit of work; a worker
 * claims a batch with `FOR UPDATE SKIP LOCKED` so concurrent worker runs never
 * process the same row twice. `type` keys into the handler registry
 * (`src/features/jobs/handlers/index.ts`); `payload` is small, serializable
 * input the handler re-derives fresh state from (an id, not a full snapshot).
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    /** Claimable once <= now(). Set into the future for backoff between retries. */
    runAt: timestamp("run_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // The worker's claim query filters status + run_at and orders by run_at.
    index("jobs_status_run_at_idx").on(table.status, table.runAt),
  ],
);

export type JobRow = typeof jobs.$inferSelect;
export type NewJobRow = typeof jobs.$inferInsert;
```

Add `import * as jobsSchema from "./jobs.schema";` to `src/db/schemas/index.ts`
and spread it into the exported `schema`, matching `rate-limit.schema.ts`'s
wiring.

Generate: `bun run db:generate` (confirm the next free number first — see
Decision 4). Confirm the output is one file containing `CREATE TYPE "job_status"`
and `CREATE TABLE "jobs"` only.

**Verify**: `bun run type-check` → exit 0; one new migration file with
exactly those two statements.

### Step A2: `JobsDAL` — enqueue and the `FOR UPDATE SKIP LOCKED` claim

`src/dal/jobs.dal.ts`:

```ts
import { inArray, sql } from "drizzle-orm";
import { schema } from "@/db/schemas";
import type { JobRow } from "@/db/schemas/jobs.schema";
import { BaseDAL } from "./base";

const { jobs } = schema;

export class JobsDAL extends BaseDAL {
  /** Enqueue one job, claimable immediately. Call this on the request path
   * (fast — one INSERT), not inside `after()`: durability comes from the row
   * existing, not from the enqueue call surviving. */
  async enqueue(type: string, payload: unknown): Promise<JobRow> {
    try {
      const [row] = await this.db
        .insert(jobs)
        .values({ type, payload: payload as object })
        .returning();
      if (!row) throw new Error("Job insert returned no row");
      return row;
    } catch (error) {
      this.handleError(error, "JobsDAL.enqueue");
    }
  }

  /**
   * Atomically claim up to `limit` due jobs for processing. `FOR UPDATE SKIP
   * LOCKED` inside the subquery means two overlapping worker runs (a 5-minute
   * cron tick landing on a still-running previous tick, or a `workflow_dispatch`
   * overlapping a schedule) each get a disjoint set of rows — no row is ever
   * claimed twice, so no application-level lock or `concurrency:` group is
   * required for correctness (one is still added in cron-jobs.yml for
   * consistency with the other jobs — see Step A6).
   */
  async claimBatch(limit: number): Promise<JobRow[]> {
    try {
      // Builder UPDATE, raw subquery: `.returning()` maps columns to the
      // camelCase JobRow. (Review: the draft's `db.execute(... RETURNING *)`
      // returns raw snake_case rows, so `job.maxAttempts` was undefined,
      // `attempts >= undefined` was always false, and no job ever
      // dead-lettered.)
      return await this.db
        .update(jobs)
        .set({
          status: "processing",
          attempts: sql`${jobs.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            jobs.id,
            sql`(
              SELECT id FROM jobs
              WHERE (status IN ('queued', 'failed') AND run_at <= now())
                 -- Lease expiry: a worker killed mid-job (maxDuration,
                 -- deploy, crash) leaves its row 'processing' forever
                 -- otherwise. 10 min is well past maxDuration (120s).
                 OR (status = 'processing' AND updated_at < now() - interval '10 minutes')
              ORDER BY run_at
              LIMIT ${limit}
              FOR UPDATE SKIP LOCKED
            )`,
          ),
        )
        .returning();
    } catch (error) {
      this.handleError(error, "JobsDAL.claimBatch");
    }
  }

  async markSucceeded(id: string): Promise<void> {
    try {
      await this.db
        .update(jobs)
        .set({ status: "succeeded", updatedAt: new Date() })
        .where(sql`${jobs.id} = ${id} AND status = 'processing'`);
    } catch (error) {
      this.handleError(error, "JobsDAL.markSucceeded");
    }
  }

  /** Schedule a retry: status back to 'failed' (claimable again once run_at
   * passes) with exponential backoff, capped at 1 hour. */
  async markFailedForRetry(
    id: string,
    errorMessage: string,
    backoffSeconds: number,
  ): Promise<void> {
    try {
      await this.db
        .update(jobs)
        .set({
          status: "failed",
          lastError: errorMessage.slice(0, 2000),
          runAt: sql`now() + interval '1 second' * ${backoffSeconds}`,
          updatedAt: new Date(),
        })
        .where(sql`${jobs.id} = ${id} AND status = 'processing'`);
    } catch (error) {
      this.handleError(error, "JobsDAL.markFailedForRetry");
    }
  }

  async markDeadLetter(id: string, errorMessage: string): Promise<void> {
    try {
      await this.db
        .update(jobs)
        .set({
          status: "dead_letter",
          lastError: errorMessage.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(sql`${jobs.id} = ${id} AND status = 'processing'`);
    } catch (error) {
      this.handleError(error, "JobsDAL.markDeadLetter");
    }
  }
}
```

Add `export const jobsDAL = new JobsDAL();` to `src/dal/index.ts`.

**Verify**: `bun run type-check` → exit 0.

### Step A3: Job types and the handler registry

`src/features/jobs/job-types.ts`:

```ts
export interface NeedFanOutPayload {
  needId: string;
  creatorUserId: string;
}
export interface RentalAgreementPdfPayload {
  rentalRequestId: string;
}
export interface ServiceAgreementPdfPayload {
  serviceBookingId: string;
}

export const JOB_TYPES = {
  NEED_FAN_OUT: "need_fan_out",
  RENTAL_AGREEMENT_PDF: "rental_agreement_pdf",
  SERVICE_AGREEMENT_PDF: "service_agreement_pdf",
} as const;
export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
```

`src/features/jobs/handlers/index.ts` — a typed registry the runner dispatches
through; each handler receives the raw `unknown` payload and is responsible
for its own validation (fail loud, not silently, on a malformed payload —
that's a bug, not a retryable condition, so handlers should throw a
non-retryable-looking error; see Step A4's note on this):

```ts
import { JOB_TYPES } from "../job-types";
import { handleNeedFanOut } from "./need-fan-out-handler";
import { handleRentalAgreementPdf } from "./rental-agreement-pdf-handler";
import { handleServiceAgreementPdf } from "./service-agreement-pdf-handler";

export const JOB_HANDLERS: Record<string, (payload: unknown) => Promise<void>> =
  {
    [JOB_TYPES.NEED_FAN_OUT]: handleNeedFanOut,
    [JOB_TYPES.RENTAL_AGREEMENT_PDF]: handleRentalAgreementPdf,
    [JOB_TYPES.SERVICE_AGREEMENT_PDF]: handleServiceAgreementPdf,
  };
```

**Verify**: `bun run type-check` → exit 0 (handlers don't exist yet — this
step's file won't compile until Steps A4/B1/C1 add them; write it last if
your editor complains, or stub the three handlers as `async () => {}`
first and fill them in).

### Step A4: The runner — claim, dispatch, backoff, dead-letter

`src/features/jobs/job-runner.ts`:

```ts
import { jobsDAL } from "@/dal";
import { getLogger } from "@/lib/logger";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { JOB_HANDLERS } from "./handlers";

export interface JobRunResult {
  claimed: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
}

/** Exponential backoff: 30s, 60s, 120s, 240s, capped at 1h. */
function backoffSeconds(attempts: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
}

export async function runJobBatch(batchSize = 5): Promise<JobRunResult> {
  // See the time-budget note below this block: the route loops on this
  // function until its budget is spent, so the batch stays small.
  const claimedJobs = await jobsDAL.claimBatch(batchSize);
  let succeeded = 0;
  let retried = 0;
  let deadLettered = 0;
  const deadLetterAlerts: { id: string; type: string; error: string }[] = [];

  for (const job of claimedJobs) {
    // A job reclaimed after its lease expired (see claimBatch) has already
    // used an attempt without reaching the catch below. One that keeps
    // killing the worker must still end up dead-lettered, not loop forever.
    if (job.attempts > job.maxAttempts) {
      await jobsDAL.markDeadLetter(
        job.id,
        job.lastError ?? "exceeded max attempts (worker did not finish)",
      );
      deadLettered++;
      deadLetterAlerts.push({
        id: job.id,
        type: job.type,
        error: "exceeded max attempts",
      });
      continue;
    }
    const handler = JOB_HANDLERS[job.type];
    if (!handler) {
      // An unknown type is a deploy/rollback mismatch, not a transient
      // failure — never retry it into a loop.
      await jobsDAL.markDeadLetter(
        job.id,
        `No handler registered for type '${job.type}'`,
      );
      deadLettered++;
      deadLetterAlerts.push({
        id: job.id,
        type: job.type,
        error: "unknown job type",
      });
      continue;
    }
    try {
      await handler(job.payload);
      await jobsDAL.markSucceeded(job.id);
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (job.attempts >= job.maxAttempts) {
        await jobsDAL.markDeadLetter(job.id, message);
        deadLettered++;
        deadLetterAlerts.push({ id: job.id, type: job.type, error: message });
      } else {
        await jobsDAL.markFailedForRetry(
          job.id,
          message,
          backoffSeconds(job.attempts),
        );
        retried++;
      }
    }
  }

  if (deadLetterAlerts.length > 0) {
    await sendOpsAlert({
      event: "job_dead_lettered",
      message: `${deadLetterAlerts.length} job(s) exhausted retries and need manual attention.`,
      metadata: { jobs: deadLetterAlerts },
      sendEmailAlert: true,
    });
  }

  getLogger().info(
    {
      message: "jobs.run_batch",
      claimed: claimedJobs.length,
      succeeded,
      retried,
      deadLettered,
    },
    "Job batch processed",
  );

  return { claimed: claimedJobs.length, succeeded, retried, deadLettered };
}
```

**Time budget (review).** A PDF job takes ~15-20s, so the draft's single
claim of 20 couldn't finish inside `maxDuration = 120`. Vercel would kill
the function mid-batch and strand the unstarted rows in `processing`. So
claim small batches (5) and have the route loop: call `runJobBatch(5)` again
while less than ~80s have elapsed and the last call claimed something, then
sum the results. The lease expiry in `claimBatch` is the backstop for
anything still stranded.

**Handlers must be idempotent.** A job can run more than once: after a
retry, or after a lease-expiry reclaim when the worker died after the
handler's side effect but before `markSucceeded`. The PDF generators
overwrite the same blob. The need fan-out's in-app INSERT is its only
non-idempotent effect (push failures are already swallowed), so it can
duplicate notifications on a reclaim. That's accepted as rare; see
Maintenance notes.

**Verify**: `bun run type-check` → exit 0.

### Step A5: The cron route

`src/app/api/cron/run-jobs/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { runJobBatch } from "@/features/jobs/job-runner";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";

// A batch can include PDF generation (puppeteer-core + @sparticuz/chromium),
// the slowest job type at up to ~15-20s each; 20 items headroom-doubled.
export const maxDuration = 120;

const JOB_NAME = "run-jobs";
const BATCH_SIZE = 5;
/** Stop claiming new batches after this long; leaves headroom under maxDuration. */
const TIME_BUDGET_MS = 80_000;

async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();
  try {
    // Loop small batches until the queue is empty or the budget is spent
    // (Step A4's time-budget note). Sum the per-batch counts into `result`.
    const result = { claimed: 0, succeeded: 0, retried: 0, deadLettered: 0 };
    while (Date.now() - startedAt.getTime() < TIME_BUDGET_MS) {
      const r = await runJobBatch(BATCH_SIZE);
      result.claimed += r.claimed;
      result.succeeded += r.succeeded;
      result.retried += r.retried;
      result.deadLettered += r.deadLettered;
      if (r.claimed === 0) break;
    }
    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "success",
      recordsEligible: result.claimed,
      recordsSucceeded: result.succeeded,
      recordsFailed: result.retried + result.deadLettered,
    });
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await CronRunHistoryService.recordRun({
      jobName: JOB_NAME,
      startedAt,
      completedAt: new Date(),
      status: "failure",
      errorMessage: message,
    });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/cron/run-jobs");
```

**Verify**: `bun run type-check` → exit 0.

### Step A6: Wire the 5-minute cron and the real-DB truncate list

In `.github/workflows/cron-jobs.yml`, add `"*/5 * * * *"` to the `schedule`
list, and a new job (after `hourly`, before `daily`):

```yaml
jobs-worker:
  if: github.event.schedule == '*/5 * * * *' || github.event_name == 'workflow_dispatch'
  runs-on: ubuntu-latest
  environment: production
  # SKIP LOCKED already makes overlapping claims safe (JobsDAL.claimBatch);
  # this group just keeps behavior consistent with the other cron jobs.
  concurrency:
    group: cron-${{ github.job }}
    cancel-in-progress: false
  steps:
    - name: Run jobs
      run: |
        curl --fail --max-time 120 -s -X GET \
          -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
          ${{ vars.NEXT_PUBLIC_APP_URL }}/api/cron/run-jobs
```

In `src/test/integration/setup.ts`, add `"jobs"` to `TRUNCATE_LIST` (no FK
from anything else, same reasoning as `rate_limit_buckets`).

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"` →
no error; `bun run db:push:e2e` → exit 0.

### Step A7: Tests for Part A

- `src/dal/__tests__/jobs.dal.test.ts` (new, mocked `db`, mirrors this
  suite's existing style): `enqueue` inserts with `status: 'queued'` default;
  `markSucceeded`/`markFailedForRetry`/`markDeadLetter` build the expected
  `WHERE` (render via this repo's existing SQL-render helper, matching
  `payment-lifecycle.dal.test.ts`'s style for `claimForProcessing`).
- `src/dal/__tests__/jobs.integration.test.ts` (new, real Postgres): enqueue
  3 jobs of the same type; two concurrent `claimBatch(2)` calls (`Promise.all`)
  claim **disjoint** sets summing to at most 3, proving `SKIP LOCKED` — this
  is the concurrency property the whole plan rests on, so it needs a real-DB
  test, not a mock. In the same file: the claimed rows come back camelCase
  with `maxAttempts === 5` (pins the RETURNING mapping); a row set to
  `processing` with `updated_at` 11 minutes ago is reclaimed and one 5
  minutes ago is not (lease expiry).
- `src/features/jobs/__tests__/job-runner.test.ts` (new, mocked `jobsDAL` and
  a fake handler registry — or mock `./handlers` directly): a handler that
  throws with `attempts < maxAttempts` → `markFailedForRetry` called with
  the expected backoff seconds (30 for attempt 1, 60 for attempt 2, …); a
  handler that throws with `attempts >= maxAttempts` → `markDeadLetter` +
  one `sendOpsAlert` call with all dead-lettered jobs listed; an unknown
  `type` → immediate dead-letter, handler never invoked; a claimed job with
  `attempts > maxAttempts` (a reclaimed crash-looper) → dead-lettered
  without running its handler.

**Verify**: `bun run test:run src/dal/__tests__/jobs.dal.test.ts src/features/jobs` → all pass;
`docker compose up -d && bun run db:push:e2e && bun run test:integration src/dal/__tests__/jobs.integration.test.ts` → passes.

## Part B — Move need fan-out onto the queue

### Step B1: The handler

`src/features/jobs/handlers/need-fan-out-handler.ts` — move `fanOutNewNeed`'s
current body (`neighborhood-needs-service.ts:319-383`) here verbatim, re-fetch
the need by id (the payload carries only ids, not a snapshot, so a `need`
edited between enqueue and processing is handled correctly — e.g. if it was
deleted, skip):

```ts
import { z } from "zod";
import {
  neighborhoodNeedsDAL,
  communityDAL,
  notificationsDAL,
  pushSubscriptionDAL,
} from "@/dal";
import { buildPushPayload } from "@/features/notifications/lib/push-payload";
import { broadcastPush } from "@/features/notifications/lib/push-service";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import type { NeedFanOutPayload } from "../job-types";

const payloadSchema = z.object({
  needId: z.string().uuid(),
  creatorUserId: z.string(),
});

export async function handleNeedFanOut(raw: unknown): Promise<void> {
  const { needId, creatorUserId }: NeedFanOutPayload = payloadSchema.parse(raw);
  const need = await neighborhoodNeedsDAL.getNeedById(needId);
  if (!need || need.deletedAt) return; // deleted before the job ran — nothing to notify about

  // ...body unchanged from the old fanOutNewNeed (creatorVisible check,
  // bulkCreateForVisibleCommunity, getOptInPushTargetsInCommunity +
  // broadcastPush)...
}
```

`payloadSchema.parse` throwing on a malformed payload is intentionally
**not** caught specially — it lands in the runner's normal catch block and
retries like any other failure. A payload is only ever malformed by a bug in
the enqueue call, not by anything a retry would fix, so it will exhaust
`maxAttempts` and dead-letter; that's the correct outcome (visible, not
silent), just not an instant one. If this proves too slow in practice, a
future refinement can special-case `ZodError` to dead-letter immediately —
noted in Maintenance notes, not built here to keep this step small.

**Verify**: `bun run type-check` → exit 0.

### Step B2: Enqueue instead of running inline

In `neighborhood-needs-service.ts`, replace:

```ts
after(async () => {
  await fanOutNewNeed(need, userId).catch((err) =>
    captureNonCriticalError(err, {
      route: "/api/needs",
      action: "fanOutNewNeed",
    }),
  );
});
```

with a synchronous enqueue (durability comes from this insert landing before
the response, not from `after()` completing) plus a best-effort kick:

```ts
// The need row already exists. A failed enqueue must not 500 the create,
// because the client would retry and post a duplicate need. Losing the
// fan-out is what happens today, so capture it and move on.
const { error: enqueueError } = await tryCatch(
  jobsDAL.enqueue(JOB_TYPES.NEED_FAN_OUT, {
    needId: need.id,
    creatorUserId: userId,
  }),
);
if (enqueueError) {
  captureNonCriticalError(enqueueError, {
    route: "/api/needs",
    action: "enqueue_need_fan_out",
  });
}
after(() => kickJobRunner()); // best-effort; the 5-minute cron is the backstop
```

(Review: the draft enqueued with a bare `await`. A true outbox, with the
need insert and the job insert in one transaction, is the stronger fix;
it's a follow-up in Maintenance notes.)

Add a small shared helper (used again in Part C) — `src/features/jobs/kick.ts`:

```ts
/** Best-effort nudge so a freshly enqueued job runs in seconds, not up to 5
 * minutes. Never throws; the cron is the durability guarantee, this is
 * latency-only. */
export function kickJobRunner(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!secret || !baseUrl) return Promise.resolve();
  return fetch(`${baseUrl}/api/cron/run-jobs`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5000),
  })
    .then(() => undefined)
    .catch(() => undefined);
}
```

Delete the now-unused `fanOutNewNeed` function and any imports that become
unused in `neighborhood-needs-service.ts` (`buildPushPayload`,
`broadcastPush`, etc. — moved to the handler).

**Verify**: `bun run type-check` → exit 0; `grep -n "fanOutNewNeed" src/features/neighborhood-needs/services/neighborhood-needs-service.ts` → no matches.

### Step B3: Tests for Part B

R-PERF-02's query-count test (500 visible members, few total queries) is a
**real-DB** test: `src/features/neighborhood-needs/services/__tests__/need-fanout.integration.test.ts`
(checked in review). It mocks `after` to capture the callback, calls
`createNeed`, then runs the captured callback under a query spy. After
Part B that callback is only the kick. Retarget the file: keep
`createNeed` for the setup, assert a `jobs` row with
`type = 'need_fan_out'` exists, then call `handleNeedFanOut(row.payload)`
under the spy, keeping the same query-count bound and recipient
assertions. Mock `@/features/jobs/kick` so no `fetch` runs. Update
`neighborhood-needs-service.test.ts`'s `createNeed` unit test: asserts
`jobsDAL.enqueue` is called with `{needId, creatorUserId}`, and that an
enqueue rejection doesn't throw from `createNeed` (it captures instead).
Its `"fanOutNewNeed.push"` action assertion (`:280`) moves to the handler's
test.

**Verify**: `bun run test:run src/features/neighborhood-needs src/features/jobs` → all pass.

## Part C — Move agreement-PDF generation onto the queue

### Step C1: The two handlers

`src/features/jobs/handlers/rental-agreement-pdf-handler.ts`:

```ts
import { z } from "zod";
import { rentalDAL } from "@/dal";
import { generateAndStoreRentalAgreement } from "@/services/playwright/generate-rental-agreements";
import type { RentalAgreementPdfPayload } from "../job-types";

const payloadSchema = z.object({ rentalRequestId: z.string().uuid() });

export async function handleRentalAgreementPdf(raw: unknown): Promise<void> {
  const { rentalRequestId }: RentalAgreementPdfPayload =
    payloadSchema.parse(raw);
  const rentalRequest = await rentalDAL.getRentalRequestById(rentalRequestId);
  if (!rentalRequest) return; // deleted/archived before the job ran
  await generateAndStoreRentalAgreement(rentalRequest);
}
```

Read `src/app/api/internal/generate-rental-agreement/route.ts` fully before
writing this — copy its exact call shape into `rentalRequest` (it may pass
a differently-shaped object than the raw DAL row; match it exactly rather
than assuming). Mirror the same structure for
`handleServiceAgreementPdf`/`generate-service-agreements` from
`generate-service-agreement/route.ts`.

**Verify**: `bun run type-check` → exit 0.

### Step C2: Enqueue instead of the internal `fetch`

In `rental-service.ts`, inside `approveRentalRequest`, replace the whole
`if (internalSecret && baseUrl) { ...fetch... }` PDF block (inside the
existing `after()`, after the notifications) with:

```ts
// Post-charge: the renter has paid and the rental is approved. An enqueue
// failure must never fail the approval response (that would read as
// "payment failed" to the owner). Capture it and alert: the PDF is missing.
const { error: pdfEnqueueError } = await tryCatch(
  jobsDAL.enqueue(JOB_TYPES.RENTAL_AGREEMENT_PDF, {
    rentalRequestId: rentalRequest.id,
  }),
);
if (pdfEnqueueError) {
  captureNonCriticalError(pdfEnqueueError, {
    route: "RentalService.approveRentalRequest",
    action: "enqueue_rental_agreement_pdf",
  });
}
```

**Move this block out of `after()` and up to right after the rental row is
created** (near where `createdRental`/`rentalPaymentIntent` are available,
alongside the payment/lifecycle row writes) — not after the notification
send — so the PDF job is durably queued even if the notification step
throws first. Keep `after(() => kickJobRunner())` once, after both the need
job (if this path also closes needs) and the PDF job are enqueued. Do the
equivalent in `service-booking-service.ts`'s `acceptBooking` (its PDF
`after()` block is separate from its needs-closing `after()` block — merge
the enqueue calls, keep one `kickJobRunner()` call). The service enqueue
goes **after** Region B's persistence succeeds, never inside Region B's
try: a throw there takes the "charged but not persisted" ops-alert path.
Same `tryCatch` + capture treatment.

`internalSecret`/`baseUrl`-gated console logging (`[pdf-gen] triggering`,
etc.) goes away with the fetch; the job row itself (queryable via
`bun run db:studio` or a future admin view) replaces those log lines as the
"did this fire" signal.

**Verify**: `bun run type-check` → exit 0; `grep -n "generate-rental-agreement\|generate-service-agreement" src/features/rentals/services/rental-service.ts src/features/services/services/service-booking-service.ts` → no matches (the internal routes stay, unreferenced from these two files — see Maintenance notes).

### Step C3: Tests for Part C

Extend `rental-service.approve.test.ts` and the service accept test: assert
`jobsDAL.enqueue` is called with `JOB_TYPES.RENTAL_AGREEMENT_PDF`/
`SERVICE_AGREEMENT_PDF` and the right id, and that no `fetch` mock is hit.
New `rental-agreement-pdf-handler.test.ts` /
`service-agreement-pdf-handler.test.ts`: mock the DAL and the generator
function; a missing rental request/booking → generator not called, no throw
(the "deleted before the job ran" branch).

**Verify**: `bun run test:run src/features/rentals src/features/services src/features/jobs` → all pass.

## Part D — Daily Stripe↔DB reconciliation cron

### Step D1: A shared "find transfers for a charge" helper

`src/services/stripe/payout.ts`, add:

```ts
/**
 * List transfers Stripe has already made from `chargeId` to `destinationAccountId`.
 * Used by reconciliation (Part D) and the reset-transfer-status guard (Part
 * E) to answer "did this money already move?" before creating another
 * transfer. Stripe has no "list transfers by source_transaction" filter, so
 * this lists by destination (bounded, one connected account) and filters
 * client-side — acceptable at this data volume; revisit if a connected
 * account ever accumulates thousands of transfers.
 */
export async function findTransfersForCharge(
  chargeId: string,
  destinationAccountId: string,
  /** Lower bound: no transfer for this charge can predate it. */
  since: Date,
): Promise<Stripe.Transfer[]> {
  const found: Stripe.Transfer[] = [];
  // Auto-paginate. The draft read one page of 100, which silently misses the
  // match once a connected account has more than 100 newer transfers.
  for await (const t of PAYMENT_SERVER_INSTANCE.transfers.list({
    destination: destinationAccountId,
    created: { gte: Math.floor(since.getTime() / 1000) },
    limit: 100,
  })) {
    const src =
      typeof t.source_transaction === "string"
        ? t.source_transaction
        : t.source_transaction?.id;
    if (src === chargeId) found.push(t);
  }
  return found;
}
```

Callers pass the lifecycle row's `createdAt` as `since`, since the charge
can't be older than its lifecycle row by more than a few seconds. Subtract a
day to be safe.

**Verify**: `bun run type-check` → exit 0.

### Step D2: The reconciliation service

`src/features/admin/services/stripe-reconciliation-service.ts` — modeled
directly on `StaleProcessingDetectionService`: query, then **one** summary
alert if anything is found.

```ts
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import {
  paymentDAL,
  paymentLifecycleDAL,
  servicePaymentLifecycleDAL,
} from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

export interface ReconciliationResult {
  unmatchedCharges: string[]; // PaymentIntent ids
  duplicateTransferSources: string[]; // charge ids with >1 transfer
  untrackedTransfers: string[]; // transfer ids no lifecycle row records
  reversalMismatches: string[]; // transfer ids fully reversed at Stripe, not `reversed` here
  refundMismatches: string[]; // payment ids
  windowStart: string;
  windowEnd: string;
}

/**
 * Compare yesterday's Stripe activity against our tables. Window is
 * [now-48h, now-24h): a full day of margin so a legitimate write that races
 * its webhook (documented at webhook-handlers.ts:144) always has time to
 * land before being judged missing.
 */
export async function reconcileStripeWithDb(): Promise<ReconciliationResult> {
  const windowEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const created = {
    gte: Math.floor(windowStart.getTime() / 1000),
    lt: Math.floor(windowEnd.getTime() / 1000),
  };

  const unmatchedCharges: string[] = [];
  const duplicateTransferSources: string[] = [];
  const untrackedTransfers: string[] = [];
  const reversalMismatches: string[] = [];
  const refundMismatches: string[] = [];

  // 1. Charges: every succeeded rental_charge/service_charge PI must have a
  // payments row (BIZ-11 — the "was this actually charged twice, or once
  // and never recorded?" question this plan's audit finding raised).
  // Iterate PaymentIntents, not Charges: `paymentType` is set on the PI's
  // metadata (rental-payments.ts, service-payments.ts), and the code never
  // relies on it being copied onto the Charge.
  for await (const pi of PAYMENT_SERVER_INSTANCE.paymentIntents.list({
    created,
    limit: 100,
    expand: ["data.latest_charge"],
  })) {
    if (pi.status !== "succeeded") continue;
    const paymentType = pi.metadata?.paymentType;
    if (paymentType !== "rental_charge" && paymentType !== "service_charge")
      continue;
    const payment = await paymentDAL.getByPaymentIntentId(pi.id);
    if (!payment) {
      unmatchedCharges.push(pi.id);
      continue;
    }
    const charge =
      typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    const refundedCents = charge?.amount_refunded ?? 0;
    if (refundedCents === 0) continue;
    // Expected status. After R-BIZ-14: full → 'refunded', partial →
    // 'partially_refunded'. Before R-BIZ-14 lands, accept 'refunded' for both.
    const expectedStatus =
      refundedCents >= (charge?.amount ?? pi.amount)
        ? "refunded"
        : "partially_refunded";
    const recordedCents = Math.round(Number(payment.refundAmount ?? "0") * 100);
    // Either disagreement is a mismatch. (Review: the draft ANDed the two,
    // so a wrong amount on a row already marked refunded was never flagged.)
    if (recordedCents !== refundedCents || payment.status !== expectedStatus) {
      refundMismatches.push(payment.id);
    }
  }

  // 2. Transfers. Two signatures of BIZ-11's "repeated a succeeded
  // transfer":
  //  (a) two owner/provider payouts from one charge inside this window;
  //  (b) a transfer no lifecycle row records. That catches a repeat made
  //      days after the original, which a single window never sees twice.
  //      (Review: the draft only had (a), and a reset-driven repeat lands
  //      in a different daily window from the original.)
  const bySource = new Map<string, number>();
  for await (const transfer of PAYMENT_SERVER_INSTANCE.transfers.list({
    created,
    limit: 100,
  })) {
    // Captured-deposit transfers (createDepositTransfer, BIZ-04) share no
    // source charge with the payout and live in the dispute ledger, not on
    // a lifecycle row.
    if (transfer.metadata?.kind === "captured_deposit") continue;
    const src =
      typeof transfer.source_transaction === "string"
        ? transfer.source_transaction
        : transfer.source_transaction?.id;
    if (src) bySource.set(src, (bySource.get(src) ?? 0) + 1);

    const rentalRow = await paymentLifecycleDAL.getByTransferId(transfer.id);
    const serviceRow = rentalRow
      ? null
      : await servicePaymentLifecycleDAL.getByTransferId(transfer.id);
    const row = rentalRow ?? serviceRow;
    if (!row) {
      untrackedTransfers.push(transfer.id);
    } else if (transfer.reversed && row.ownerTransferStatus !== "reversed") {
      // After R-CONC-04 a full reversal must read `reversed`. Before it,
      // the transfer.reversed webhook wrote `failed`, so accept `failed`
      // too until CONC-04 lands.
      reversalMismatches.push(transfer.id);
    }
  }
  for (const [chargeId, count] of bySource) {
    if (count > 1) duplicateTransferSources.push(chargeId);
  }

  const result: ReconciliationResult = {
    unmatchedCharges,
    duplicateTransferSources,
    untrackedTransfers,
    reversalMismatches,
    refundMismatches,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };

  const total =
    unmatchedCharges.length +
    duplicateTransferSources.length +
    untrackedTransfers.length +
    reversalMismatches.length +
    refundMismatches.length;
  if (total > 0) {
    await sendOpsAlert({
      event: "stripe_reconciliation_mismatch",
      message:
        `${unmatchedCharges.length} unmatched charge(s), ` +
        `${duplicateTransferSources.length} charge(s) with duplicate transfers, ` +
        `${untrackedTransfers.length} untracked transfer(s), ` +
        `${reversalMismatches.length} reversal mismatch(es), ` +
        `${refundMismatches.length} refund mismatch(es) in ${windowStart.toISOString()}..${windowEnd.toISOString()}.`,
      metadata: result,
      sendEmailAlert: true,
    });
  }

  return result;
}
```

Both lifecycle DALs' `getByTransferId` already exist
(`payment-lifecycle.dal.ts:227`, `service-payment-lifecycle.dal.ts`).
Refunds made days after the charge fall outside this charge-created window.
Catching them means a pass over `refunds.list({ created })`, which is a
follow-up (Maintenance notes). Read
`PAYMENT_SERVER_INSTANCE.paymentIntents.list`'s and `.transfers.list`'s actual
return type in `node_modules/stripe` before assuming `for await` auto-pagination
is available on this SDK version (it is, on all recent `stripe-node` — the
`ApiListPromise` return type implements `AsyncIterable`); if it isn't, page
manually with `starting_after`.

**Verify**: `bun run type-check` → exit 0.

### Step D3: The cron route, wired into `daily`

`src/app/api/cron/reconcile-stripe/route.ts` — same shape as
`process-payouts/route.ts`, calling `reconcileStripeWithDb()`, `maxDuration = 60`
(list calls, no per-row Stripe writes). Add one step to `cron-jobs.yml`'s
`daily` job (after `rental-reminders`), and add its step id to that job's
"Check job status" list:

```yaml
- name: Reconcile Stripe with DB
  id: reconcile-stripe
  continue-on-error: true
  run: |
    curl --fail --max-time 90 -s -X GET \
      -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
      ${{ vars.NEXT_PUBLIC_APP_URL }}/api/cron/reconcile-stripe
```

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"` → no error.

### Step D4: Tests for Part D

`stripe-reconciliation-service.test.ts` (new, mock
`PAYMENT_SERVER_INSTANCE.paymentIntents.list`/`.transfers.list` as async iterables
per this repo's existing Stripe-mocking pattern, e.g.
`rental-service.approve.test.ts:74`): a succeeded charge with no matching
`payments` row → `unmatchedCharges` includes its PI id and one
`sendOpsAlert` call; two transfers sharing one `source_transaction` →
`duplicateTransferSources` includes that charge id; a transfer no lifecycle
row records → `untrackedTransfers`; a `captured_deposit` transfer → ignored;
a `reversed: true` transfer whose row reads `completed` → `reversalMismatches`;
a charge whose `amount_refunded` doesn't match `refundAmount` **on a row
already marked `refunded`** → flagged (the draft's AND missed this); a
partial refund on a `partially_refunded` row with matching cents → not
flagged; a fully-matching fixture set → empty arrays, no alert.

**Verify**: `bun run test:run src/features/admin/services/__tests__/stripe-reconciliation-service.test.ts` → all pass.

## Part E — Guard against repeating a successful transfer (BIZ-11)

### Step E1: Check Stripe before allowing a transfer-status reset

In `payment-lifecycle-admin-service.ts`'s `resetTransferStatus`, after the
existing `'failed'`-only check and before `updateOwnerTransferStatus`, add a
lookup using Step D1's helper. You need the rental's charge id and the
owner's connected account id — extend `paymentLifecycleDAL.getByRentalId`'s
join (or add a small dedicated query) to fetch
`rentalChargeId`/`ownerConnectedAccountId` alongside the lifecycle row (both
already live on `rentalPaymentLifecycle`/`rentals`/`user`, per
`findEligibleForPayout`'s existing join shape — reuse that shape rather than
inventing a new one).

```ts
const { data: existingTransfers, error: lookupError } = await tryCatch(
  findTransfersForCharge(rentalChargeId, ownerConnectedAccountId, since),
);
if (lookupError) {
  // Stripe unreachable: fail CLOSED (Decision 7). The case this guard
  // exists for, an original transfer that succeeded despite a local error,
  // is likeliest exactly when Stripe is misbehaving. A manual reset can
  // wait a few minutes.
  captureNonCriticalError(lookupError, {
    route: "PaymentLifecycleAdminService.resetTransferStatus",
    action: "find_transfers_for_charge_lookup_failed",
  });
  throw new ValidationError(
    "Couldn't check Stripe for an existing transfer on this rental. Try again in a few minutes.",
  );
}
if (
  lifecycle.stripeTransferId ||
  existingTransfers.some((t) => t.reversed === false)
) {
  await sendOpsAlert({
    event: "reset_transfer_status_blocked_existing_transfer",
    rentalId,
    message: `Refused to reset: Stripe already shows a transfer for charge ${rentalChargeId}. Reconcile manually before retrying.`,
    metadata: { existingTransferIds: existingTransfers.map((t) => t.id) },
    sendEmailAlert: true,
  });
  throw new ValidationError(
    "Stripe already shows a transfer for this rental's charge. This has been reported for manual reconciliation instead of being reset.",
  );
}
```

(`since` = `new Date(lifecycle.createdAt.getTime() - 24 * 60 * 60 * 1000)`.)

This fails closed on positive evidence (a non-reversed transfer at Stripe,
**or** a `stripeTransferId` already on the row, which only a real transfer
writes) and also on "couldn't check" (Decision 7). A fully reversed transfer
doesn't block. After R-CONC-04, though, a full reversal reads `reversed`, not
`failed`, so it never reaches this `failed`-only reset in the first place.
Do the equivalent for the service-side reset action if one exists
(`grep -rn "resetTransferStatus\|reset-transfer-status" src/features/admin src/app/api/admin` —
confirm whether a service-booking twin exists; if it does, apply the same
guard there using `service-payment-lifecycle.dal.ts`'s equivalent fields).

**Verify**: `bun run type-check` → exit 0.

### Step E2: Tests for Part E

Extend `payment-lifecycle-admin-service.test.ts`: `resetTransferStatus` with
a mocked `findTransfersForCharge` returning one non-reversed transfer →
throws, `updateOwnerTransferStatus` never called, one `sendOpsAlert` call; an
empty list → proceeds as before (existing test should still pass unchanged);
a lifecycle row with `stripeTransferId` set and an empty list → throws;
a lookup rejection → throws `ValidationError` (fail-closed), reset not
applied, `captureNonCriticalError` called once.

**Verify**: `bun run test:run src/features/admin/services/__tests__/payment-lifecycle-admin-service.test.ts` → all pass.

## Test plan

Each part's tests are listed under its own steps (A7, B3, C3, D4, E2). Full
regression: `bun run test:run`. Real-DB: `docker compose up -d && bun run db:push:e2e && bun run test:integration` (must include the new `jobs.integration.test.ts`).

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0, including the `SKIP LOCKED` concurrency test
- [ ] Migration generated from the schema (not `--custom`), applied on local + confirmed on dev/staging per Production cutover
- [ ] `grep -n "fanOutNewNeed" src/features/neighborhood-needs/services/neighborhood-needs-service.ts` → no matches
- [ ] `grep -n "generate-rental-agreement\|generate-service-agreement" src/features/rentals/services/rental-service.ts src/features/services/services/service-booking-service.ts` → no matches
- [ ] `cron-jobs.yml` parses; a new `jobs-worker` job and a `reconcile-stripe` step in `daily` both exist
- [ ] `resetTransferStatus` refuses when Stripe already shows a transfer for the charge (test)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` (Phase 2 step 2; mark ARCH-04 fully DONE, noting R-PERF-05 already did the short-term half)

## STOP conditions

- Any "Current state" excerpt doesn't match live code — re-read before editing.
- `bun run db:generate` produces anything other than the `job_status`
  enum + `jobs` table (e.g., it also picks up unrelated schema drift from a
  half-landed DB-02) — stop and report.
- The `stripe-node` version installed doesn't support `for await` iteration
  on `paymentIntents.list`/`transfers.list` (Steps D1/D2) — page manually rather than
  guessing at an API shape.
- A real-DB concurrency test (Step A7) shows the same job claimed by two
  concurrent `claimBatch` calls — `FOR UPDATE SKIP LOCKED` isn't behaving as
  expected on this Postgres version; stop and report rather than adding an
  application-level lock on top.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

No API response shape changes anywhere in this plan. The two PDF-generation
call sites and the need fan-out were already fire-and-forget from the
client's perspective (their response never depended on the PDF or the
notifications completing); this plan only changes what runs after the
response and how reliably. No new stable `code`, no new status value visible
over the wire. No roadmap Mobile client follow-ups row needed.

## Production cutover

Add to `13-production-cutover.md`:

- **New row**: `R-ARCH-04 — apply migration 00NN (job_status enum + jobs table)` |
  From: R-ARCH-04 | dev: TODO | staging: TODO | prod: TODO. No data prep —
  brand-new table, nothing references it yet.
- **New row**: `R-ARCH-04 — confirm the jobs-worker cron fires every 5 minutes and reconcile-stripe runs in daily` |
  From: R-ARCH-04 | prod: TODO — check the GitHub Actions run log after the
  first deploy.
- **New row**: `R-ARCH-04 — confirm CRON_SECRET and NEXT_PUBLIC_APP_URL are set wherever `kickJobRunner` runs` |
  From: R-ARCH-04 | prod: TODO — `kickJobRunner` silently no-ops if either is
  missing (by design, so a misconfigured env never throws on the request
  path), which would silently fall back to "up to 5 minutes latency" with no
  error surfaced. Confirm once post-deploy by posting a Need and checking it
  notifies within seconds, not minutes.

## Maintenance notes

- The internal PDF routes (`/api/internal/generate-{rental,service}-agreement`)
  are now unreferenced from application code but left in place — they still
  work as a manual "force regenerate" tool for support (call them directly
  with the internal secret) and deleting them isn't necessary for this plan's
  goals. If a future admin UI wants a "resend agreement" button, wire it to
  `jobsDAL.enqueue` instead of resurrecting the HTTP hop.
- `payloadSchema.parse` failures dead-letter only after exhausting
  `maxAttempts` (Step B1's note) — a future refinement could special-case
  `ZodError` (or any error type known to be non-transient) to dead-letter on
  the first attempt. Not built here to keep the runner's error handling
  uniform and simple.
- If job volume ever grows enough that a single worker invocation's
  `LIMIT 20` can't keep up between 5-minute ticks, raise `BATCH_SIZE` before
  reaching for a different queue technology — the `SKIP LOCKED` claim scales
  to many more rows per call before it becomes the bottleneck.
- `dead_letter` rows have no admin UI to inspect/requeue yet; today that's a
  direct DB query/update, the same maturity level as every other manual
  reconciliation step in `13-production-cutover.md`. Worth a follow-up admin
  page once job volume justifies it.
- The reconciliation job's `unmatchedCharges`/`duplicateTransferSources`
  cross-check for service-side transfers reuses the same `bySource` map
  (Stripe charge ids are unique across rentals and services) — no separate
  service-side pass is needed if you extend Part D later.
- **Refunds made after the charge's window** aren't reconciled. Part D keys
  on charges created in `[now-48h, now-24h)`, so a refund issued a week
  later is never checked. The follow-up is a second pass over
  `refunds.list({ created })` for the same window, comparing each refund's
  charge against its `payments` row.
- **Transactional outbox.** Enqueueing in the same DB transaction as the row
  that triggers it (need insert, approval) would make "created but never
  enqueued" impossible. Parts B/C use a best-effort `tryCatch` enqueue
  instead because those inserts live in different DALs. Revisit when
  ARCH-01's shared transition helper gives the approval path a
  transaction to hang it on.
- **Need fan-out duplicates on reclaim.** A worker killed after the
  notifications INSERT but before `markSucceeded` re-runs the INSERT once
  the lease expires. If that ever shows up, guard the INSERT with
  `AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = … AND n.type = 'neighborhood_need_created' AND n.data->>'needId' = $needId)`.
- GitHub Actions `*/5` schedules are best-effort. Runs are often late and
  occasionally dropped under load. The kick carries the latency; the cron
  is only the durability backstop, which tolerates that.
