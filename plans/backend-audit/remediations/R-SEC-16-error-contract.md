# Plan R-SEC-16: Map drizzle's wrapped pg error code, and stop leaking DB/Stripe messages to clients

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 25e2233..HEAD -- src/dal/base.ts src/dal/blind-review.dal.ts src/dal/neighborhood-needs.dal.ts src/lib/api/route-helpers.ts src/dal/errors.ts src/dal/__tests__/base.integration.test.ts src/lib/api/__tests__/route-helpers.test.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition. (`25e2233` is
> R-PERF-02, which last touched `route-helpers.ts`, `errors.ts` and
> `route-helpers.test.ts`; line numbers here are keyed to it.)

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: MED · **Depends on**: none
  (several other plans' 409 mappings only start working once this lands —
  see "Dead 409 mappings this revives")
- **Category**: bug (systemic — error handling) / security (info disclosure)
- **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: SEC-16 (fully); ARCH-05 (the drizzle-wrapping / message-
  passthrough slice only — the substring-matching-on-`error.message` slice
  in `approve/route.ts` etc. is Phase 3 ARCH-01/ARCH-03, out of scope);
  TEST-07 (the mapping-fixture slice — the real-Postgres harness itself is
  R-TEST-HARNESS, DONE)

## Why this matters

drizzle-orm 0.45 wraps every driver error in `DrizzleQueryError`
(`node_modules/drizzle-orm/errors.js:10-19`): message
`` `Failed query: ${sql}\nparams: ${params}` ``, with the real pg error (the
one with `.code`) on `.cause`. `BaseDAL.handleError` checks `error.code`
directly, so it never matches, and every constraint violation falls into the
generic branch — `` `Database operation failed: ${error.message}` `` — which
bakes the SQL and bound parameters into the `DALError` that `handleApiError`
returns verbatim. Two costs: (1) schema, query text and sometimes literal
values (emails, phone numbers) leak to the client, logs and — since
`isUnexpectedError` also checks the unwrapped `error.code` and is therefore
always true for a drizzle error — every production Sentry event; (2) every
"already exists" 409 a unique-constraint mapping was supposed to produce
surfaces as a 500 instead, and `hoador-mobile`'s `ApiError.fromBody` treats
`body.error` as a human-readable message whenever it isn't SCREAMING_SNAKE_CASE
— so today the app renders that leaked SQL string on screen. TEST-07 is why
it shipped unnoticed: every mocked DAL test fabricates a flat
`{ code: "23505" }`, a shape drizzle never produces.

## Current state

- `src/dal/base.ts:15-67` `BaseDAL.handleError` — `error.code` checks at
  lines 21-23 (Sentry gate) and 46/51/56 (constraint mapping) are all dead
  against a real drizzle error. Line 62-63 embeds `error.message` into the
  thrown `DALError` unconditionally.
- `src/lib/api/route-helpers.ts:245-276` `handleApiError` — the `DALError`
  branch (245-250) returns `error.message` for any `DALError`, including the
  tainted generic one from `base.ts`. The final `Error` fallback (252-270)
  returns `error.message` for anything else — this is the only leak that
  survives fixing `base.ts` alone, because not every DB call goes through a
  DAL: `src/app/api/listings/[listingId]/availability/route.ts:121-131` does
  a raw `db.insert(...)` (via `tryCatch`, not a DAL method) and calls
  `handleApiError(error)` directly — an un-wrapped `DrizzleQueryError` lands
  straight in this branch.
- `src/dal/__tests__/base.integration.test.ts:39-64` — real-Postgres proof
  (`db-e2e`) that a duplicate insert throws `DrizzleQueryError` with `code`
  on `.cause`. The `it.fails` at lines 55-63 is pinned to fail once
  `handleError` is fixed; flip it to `it`.
- Two DAL methods have their **own** direct `error.code === "23505"` check —
  fixing `base.ts` alone does not revive them: `blind-review.dal.ts:65-78`
  `create()` (duplicate review) and `neighborhood-needs.dal.ts:730-745`
  `linkListing()` (duplicate need↔listing link).
- **Already fixed**: `rentals.dal.ts:2139-2148` `approveRentalRequest`
  already does `(error as {cause?:{code?:string}}).cause ?? error` before
  its `23P01` check (R-CONC-01 landed this pattern first) — model Step 2
  on it.
- **Not dead, no change**: `listing.dal.ts:2372-2383`'s `err.code ===
"42704"` check also has a message-substring fallback on `err.cause?.message`,
  which already catches the real PostGIS-unavailable case.

### Dead 409 mappings this revives

| Call site                                                                                                                                                                        | Today                                                                                                              | After this fix                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `blind-review.dal.ts:65-78` `create()` (duplicate review)                                                                                                                        | 500, raw DB message                                                                                                | 409 `{error: "You have already submitted a review for this booking"}`                                                                          |
| `neighborhood-needs.dal.ts:730-745` `linkListing()` (duplicate link)                                                                                                             | 500 → fire-and-forget `after()` in `listing-service.ts:277-289` reports Sentry noise via `captureNonCriticalError` | `ConflictError` swallowed by `neighborhood-needs-service.ts:213-216`'s existing "Swallow UNIQUE violation" catch — no error, no noise          |
| `dispute-creation-service.ts:220-232` (rental) — race backstop _after_ the `existingDispute` pre-check at line 168-174 (unaffected; already returns `DisputeAlreadyExistsError`) | 500, raw DB message                                                                                                | 409 `{error: "A dispute for this rental already exists"}` (plain `ConflictError`, no `disputeId` — a true-race edge case, not the common path) |
| `dispute-creation-service.ts:432-446` — same, service booking                                                                                                                    | 500, raw DB message                                                                                                | 409 `{error: "A dispute for this service booking already exists"}`                                                                             |

None of these introduce a status or `code` mobile lacks a bucket for — see
"Mobile compatibility". Confirmed unaffected (app-level CAS, not DB-code
driven): `rentals.dal.ts:3664` (used by `cancellation-service.ts:177`),
`user.dal.ts:141,854`, `community.dal.ts:902` (pre-check-then-insert — only a
genuine race hits the dead path).

## Commands you will need

| Purpose               | Command                                                                                                                                                                                   | Expected |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck             | `bun run type-check`                                                                                                                                                                      | exit 0   |
| Lint                  | `bun run lint`                                                                                                                                                                            | exit 0   |
| Targeted unit tests   | `bun run test:run src/dal/__tests__/base.test.ts src/dal/__tests__/blind-review.dal.test.ts src/dal/__tests__/neighborhood-needs.dal.test.ts src/lib/api/__tests__/route-helpers.test.ts` | all pass |
| Real-Postgres harness | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                                                                 | all pass |
| Full suite            | `bun run test:run`                                                                                                                                                                        | all pass |

## Scope

**In scope**: `src/dal/base.ts` (`handleError`); `src/dal/blind-review.dal.ts`
(`create()`'s own check); `src/dal/neighborhood-needs.dal.ts`
(`linkListing()`'s own check); `src/lib/api/route-helpers.ts`
(`handleApiError`'s final generic-`Error` fallback only); new
`src/dal/__tests__/base.test.ts`; `base.integration.test.ts` (flip
`it.fails`); `route-helpers.test.ts` (one new test).

**Out of scope**: substring-matching status codes in `approve/route.ts:72-91`,
`cancel/route.ts`, `admin/rentals/[id]/no-show/route.ts` (ARCH-05's other
half, Phase 3 ARCH-01/ARCH-03); cron routes' `error.message` in their own
JSON (internal, bearer-secret-gated, not client-facing); `listing.dal.ts`'s
`42704` check and `rentals.dal.ts`'s `23P01` check (both already fine, see
above); editing `blind-review.dal.test.ts` / `neighborhood-needs.dal.test.ts`
— their flat `{code}` mocks still match after Step 2, no changes needed.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes
uncommitted for the maintainer to review and commit.

## Steps

### Step 1: Fix `BaseDAL.handleError`

In `src/dal/base.ts`, replace the whole `handleError` method body:

```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handleError(error: any, operation: string): never {
    console.error(`DAL Error in ${operation}:`, error);

    // drizzle-orm 0.45 wraps every driver error in `DrizzleQueryError`; the
    // real pg error (with `.code`) lives on `.cause`, not on the error
    // itself (SEC-16). Falling back to `error` keeps this working for a
    // driver error that isn't wrapped, and for mocked `{code}` fixtures.
    const pgError = error?.cause ?? error;
    const pgCode = pgError?.code;

    const isUnexpectedError =
      process.env.NODE_ENV === "production" &&
      pgCode !== "23505" &&
      pgCode !== "23503" &&
      pgCode !== "23514";

    if (isUnexpectedError) {
      Sentry.captureException(error, {
        tags: { error_type: "dal_error", operation, error_code: pgCode },
        contexts: { database: { operation, error_code: pgCode } },
      });
    }

    if (error instanceof DALError) {
      throw error;
    }

    if (pgCode === "23505") {
      throw new ConflictError("A record with this value already exists");
    }
    if (pgCode === "23503") {
      throw new ValidationError("Referenced record does not exist");
    }
    if (pgCode === "23514") {
      throw new ValidationError("Invalid data provided");
    }

    // Generic database error. Never put the driver message in the client
    // response (SEC-16) — it's already logged above (console.error, and to
    // Sentry when unexpected) with the operation name for correlation.
    throw new DALError(
      "A database error occurred. Please try again.",
      "DATABASE_ERROR",
      500,
    );
  }
```

Straight replacement — no signature or caller changes.

**Verify**: `bun run type-check` → exit 0.

### Step 2: Fix the two DAL-level own-code checks

Same pattern as `rentals.dal.ts:2141`, in both places. In `create()`
(`src/dal/blind-review.dal.ts:65-78`):

```ts
    } catch (error) {
      const pgError =
        (error as { cause?: { code?: string } } | null)?.cause ?? error;
      if (
        pgError &&
        typeof pgError === "object" &&
        "code" in pgError &&
        (pgError as { code?: string }).code === "23505"
      ) {
        throw new ConflictError(
          "You have already submitted a review for this booking",
        );
      }
      this.handleError(error, "BlindReviewDAL.create");
    }
```

In `linkListing()` (`src/dal/neighborhood-needs.dal.ts:730-745`):

```ts
    } catch (error) {
      const pgError = (error as { cause?: { code?: string } }).cause ?? error;
      if ((pgError as { code?: string }).code === "23505") {
        throw new ConflictError(
          "This listing is already linked to a neighborhood need",
        );
      }
      this.handleError(error, "linkListing");
    }
```

**Verify**: `bun run type-check` → exit 0.

### Step 3: Stop leaking a message through `handleApiError`'s fallback

`src/lib/api/route-helpers.ts` was just touched by R-PERF-02 — re-read it
first. In `handleApiError`'s final `error instanceof Error` branch
(~252-270), change only the last `return`:

```ts
if (error instanceof Error) {
  if (error.message.includes("not found")) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (
    error.message.includes("Unauthorized") ||
    error.message.includes("Authentication")
  ) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Unclassified 500: could be a raw driver error from a route that
  // queries `db` directly (availability route's `db.insert`) or an
  // unwrapped Stripe error — both can carry SQL, params or account detail
  // in `.message` (SEC-16). Already logged above; never in the body.
  const ctx = getRequestContext();
  return NextResponse.json(
    {
      error: "An unexpected error occurred",
      ...(ctx?.requestId && { requestId: ctx.requestId }),
    },
    { status: 500 },
  );
}
```

Leave the two `.includes(...)` branches alone (curated app-thrown messages,
not driver/Stripe — cleaning those up is the separate ARCH-05 item) and
leave the `DALError` branch alone (after Step 1 every `DALError` it sees is
already safe).

**Verify**: `bun run type-check` → exit 0.

### Step 4: Flip the pinned test

In `base.integration.test.ts`, replace the `it.fails` block (lines 52-63):

```ts
it("is mapped to ConflictError by BaseDAL.handleError (SEC-16, roadmap 1.7)", async () => {
  const error = await duplicateEmailError();
  const probe = new ProbeDAL();

  expect(() => probe.map(error)).toThrow(ConflictError);
});
```

**Verify**: `docker compose up -d && bun run db:push:e2e && bun run test:integration src/dal/__tests__/base.integration.test.ts` → both tests pass.

### Step 5: Mocked unit tests for `handleError`

Create `src/dal/__tests__/base.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { BaseDAL } from "../base";
import { ConflictError, ValidationError, DALError } from "../errors";

vi.mock("@sentry/nextjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/nextjs")>()),
  captureException: vi.fn(),
}));

class ProbeDAL extends BaseDAL {
  map(error: unknown): never {
    this.handleError(error, "ProbeDAL.map");
  }
}

describe("BaseDAL.handleError (SEC-16 / TEST-07 / roadmap 1.7)", () => {
  const probe = new ProbeDAL();

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each([
    ["DrizzleQueryError shape (code on .cause)", { cause: { code: "23505" } }],
    [
      "flat { code } shape (back-compat with existing mocked DAL tests)",
      { code: "23505" },
    ],
  ])("maps a unique violation, %s, to ConflictError", (_label, shape) => {
    const error = Object.assign(new Error("dup"), shape);
    expect(() => probe.map(error)).toThrow(ConflictError);
  });

  it.each(["23503", "23514"])(
    "maps .cause code %s to ValidationError",
    (code) => {
      const error = Object.assign(new Error("wrapped"), { cause: { code } });
      expect(() => probe.map(error)).toThrow(ValidationError);
    },
  );

  it("never repeats the driver message in an unrecognized error's mapping", () => {
    const secret =
      'Failed query: select * from "user" where email = $1\nparams: ["x@example.com"]';
    const error = Object.assign(new Error(secret), {
      cause: { code: "42704", message: 'column "foo" does not exist' },
    });

    let caught: unknown;
    try {
      probe.map(error);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(DALError);
    expect((caught as DALError).statusCode).toBe(500);
    expect((caught as DALError).message).not.toContain("Failed query");
    expect((caught as DALError).message).not.toContain("params:");
    expect((caught as DALError).message).not.toContain("does not exist");
  });

  // Side effect of the fix worth pinning: today `isUnexpectedError` checks
  // the unwrapped `error.code`, so it's always true for a drizzle error and
  // every constraint violation reaches Sentry in production. After the fix
  // it doesn't.
  it("does not report an expected constraint violation to Sentry in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const error = Object.assign(new Error("dup"), { cause: { code: "23505" } });
    expect(() => probe.map(error)).toThrow(ConflictError);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
```

**Verify**: `bun run test:run src/dal/__tests__/base.test.ts` → all pass.

### Step 6: No-leak test in `route-helpers.test.ts`

Also just touched by R-PERF-02 — re-read first (it already mocks
`@sentry/nextjs`; reuse it). Inside `describe("handleApiError", ...)`, add:

```ts
it("should not leak a raw DB/Stripe error message on an unclassified 500 (SEC-16)", async () => {
  const leaked =
    'Failed query: select * from "user" where email = $1\nparams: ["x@example.com"]';
  const response = handleApiError(new Error(leaked));

  expect(response.status).toBe(500);
  const body = await response.json();
  expect(body.error).toBe("An unexpected error occurred");
  expect(JSON.stringify(body)).not.toContain("Failed query");
  expect(JSON.stringify(body)).not.toContain("params:");
});
```

**Verify**: `bun run test:run src/lib/api/__tests__/route-helpers.test.ts` →
all pass, including the pre-existing "standard Error" tests (they only
assert `status`, not body content).

## Test plan

- `base.integration.test.ts` (real Postgres): both tests pass, no `it.fails`.
- `base.test.ts` (new, mocked): mapping + no-leak + Sentry-noise coverage.
- `route-helpers.test.ts`: one new no-leak test; rest of the file unchanged.
- `blind-review.dal.test.ts` / `neighborhood-needs.dal.test.ts`: run
  unchanged, confirming back-compat with Step 2.
- `bun run test:run` → all pass. `docker compose up -d && bun run db:push:e2e && bun run test:integration` → all pass.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0 (Steps 5-6 tests included)
- [ ] `bun run test:integration` (after `db:push:e2e`) → exit 0
- [ ] `grep -rn "it.fails" src/dal/__tests__/base.integration.test.ts` → no matches
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      ("Execution order & status" and the Phase 1 table's 1.7 row)

## STOP conditions

- Drift check shows changes to any in-scope file beyond commit `25e2233` —
  re-read live files; line numbers here are keyed to that commit.
- No local Postgres available for Step 4 (the harness) — report rather than
  skip it silently; Steps 1-3 and 5-6 don't need it.
- `grep -rn "Database operation failed" src` (run before Step 1) turns up a
  test or caller asserting that exact string — report rather than silently
  changing the message.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

No field is removed and no new required `code` is introduced. The four
previously-dead 409s all use the existing generic `ConflictError` →
`{error: message}`, status 409 — `hoador-mobile/src/api/errors.ts:90`
already buckets any 409 as `kind: 'conflict'` from status alone, so no new
"Mobile client follow-ups" row is needed. Net effect for the user: these
cases go from a 500 whose `body.error` today literally is the leaked
`Database operation failed: Failed query: …` string (`ApiError.fromBody`
treats any non-SCREAMING_SNAKE_CASE `error` as a display message, so it
renders on screen) to a 409 with the curated prose already written for it —
strictly better, no app change needed. Checked `hoador-mobile/src/api`:
`errors.ts` classifies purely on HTTP `status` and the `code` field; message
text is display-only, never branched on (`grep -rn "\.message\b"
hoador-mobile/src/api` — no logic hits). The dispute-filing screen already
branches on `DISPUTE_ALREADY_EXISTS` + `disputeId` from the untouched
pre-check path; the two race-backstops this plan revives return a generic
409 with no `disputeId`, and `use-file-dispute.ts`'s `onError: (error:
ApiError) => void` is generic enough to take that without special-casing.

## Maintenance notes

Steps 2-3 mirror the pattern `rentals.dal.ts:2141` already uses for its
`23P01` check (from R-CONC-01): `(error as {cause?:{code?:string}}).cause ??
error`. A future DAL method needing its own code check should follow that
pattern, or better, rely on `base.ts`'s generic mapping and only add a
specific message when "A record with this value already exists" isn't
good enough. When Phase 3's ARCH-01/ARCH-03 land the shared claim helper and
policy module, replace the substring-matching left in
`approve/route.ts`/`cancel/route.ts`/`no-show/route.ts` the same way this
plan replaced the DAL-level checks.
