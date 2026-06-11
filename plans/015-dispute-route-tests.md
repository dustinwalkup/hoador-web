# Plan 015: Route tests for the five untested dispute endpoints

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ad0306e..HEAD -- src/app/api/disputes src/features/disputes/lib/state-machine.ts`
> If any in-scope route file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (test-only; no production code changes)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `ad0306e`, 2026-06-10

## Why this matters

Disputes move money (resolutions trigger deposit captures/refunds). Of the 7
dispute route files, only 2 have tests (`disputes/route.ts` and
`[id]/resolve`). The untested five include:

- `PATCH [id]/state` — whose **only** authorization is the
  `DisputeStateMachine` rejecting non-admin transitions. Today every
  reachable target state is in `ADMIN_ONLY_STATES`, so non-admins can do
  nothing — but the route never checks the caller is admin _or even a party
  to the dispute_, so one edit to that list silently opens admin-only
  transitions to any logged-in user. A test must pin this.
- `POST [id]/evidence` — party-only access, status gating, deadline, item
  cap, text/file validation; none covered.
- `[id]` GET, `[id]/notes` (POST/PUT/DELETE), `[id]/audit` GET — access
  control paths with zero coverage.

These tests are regression armor for the route-level auth, mirroring what
plan 006 did for money/admin/cron routes.

## Current state

Route files under test (all in `src/app/api/disputes/`):

| File                     | Handlers        | Auth model (as read in code)                                                                                                                                                                                                                                                                                                              |
| ------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[id]/route.ts`          | GET             | `getAuthenticatedUserResponse()`; non-admins must be a party (requester/provider via `serviceBookingDAL.getById`, or renter/owner via `rentalDAL.getRentalDetailsById`) else 403; dispute without linked transaction → 400                                                                                                                |
| `[id]/evidence/route.ts` | POST            | party-only (same lookup pattern); dispute status must be `open`/`evidence_requested`/`under_review` else 400; `disputeDAL.checkEvidenceDeadline` expired → 400; `countEvidenceByDisputeAndUser >= 10` → 422; file XOR text required; text 10–5000 chars; creates evidence + audit log → 201                                               |
| `[id]/state/route.ts`    | PATCH           | any authenticated user reaches `DisputeStateMachine.validateTransition(current, new, isAdmin)`; invalid → 400; valid → `updateState`, conditional 48h `setAdditionalEvidenceDeadline` on `under_review`, dispute audit log + `auditLogDAL` entries, notification on `evidence_requested` (failure → `captureNonCriticalError`, non-fatal) |
| `[id]/notes/route.ts`    | POST/PUT/DELETE | explicit `isAdmin` check → 403; Zod schemas (`content` min 1; `noteId` uuid); PUT **updates the note before** verifying `updatedNote.disputeId === disputeId` (then 400); DELETE verifies membership first → 404                                                                                                                          |
| `[id]/audit/route.ts`    | GET             | `requireAdminResponse()`; 404 when dispute missing; returns audit logs                                                                                                                                                                                                                                                                    |

State machine facts (`src/features/disputes/lib/state-machine.ts:7-23`):

```ts
const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["evidence_requested", "under_review", "resolved"],
  evidence_requested: ["under_review", "resolved"],
  under_review: ["resolved"],
  resolved: ["closed"],
  closed: [],
};
const ADMIN_ONLY_STATES: DisputeStatus[] = [
  "evidence_requested",
  "under_review",
  "resolved",
  "closed",
];
```

Every transition target is admin-only ⇒ non-admin always gets
`{ valid: false, error: "Admin privileges required to transition to <s>" }`
→ route returns 400. **Use the real state machine in tests** (pure logic, no
I/O) — that is the regression pin.

### Test convention (repo standard since plan 006 — CLAUDE.md)

Route tests mock the **session layer** (`@/features/auth/utils/session`) and
run the REAL `@/lib/api/route-helpers`, so a regression in the helpers or a
removed auth call fails the test. Exemplar to copy:
`src/app/api/rentals/[id]/approve/__tests__/route.test.ts` (its header
comment explains the pattern; copy its `vi.mock` blocks for the session
module and `with-request-logging` identity wrapper).

⚠️ The existing `src/app/api/disputes/__tests__/route.test.ts` mocks
`@/lib/api/route-helpers` wholesale — that is the OLD pattern. Do **not**
copy it; do not rewrite it either (out of scope).

Before writing requests: read `getAuthenticatedUserResponse`,
`requireAdminResponse`, and `parseFormData` in `src/lib/api/route-helpers.ts`
to learn (a) which session functions they call — mock exactly those, with an
admin/non-admin/unauthenticated user fixture — and (b) what body encoding
`parseFormData` expects (JSON vs form data) so the `NextRequest` bodies in
state/notes tests parse correctly.

## Commands you will need

| Purpose    | Command                                 | Expected on success |
| ---------- | --------------------------------------- | ------------------- |
| New tests  | `bun run test:run src/app/api/disputes` | all pass            |
| Typecheck  | `bun run type-check`                    | exit 0              |
| Full suite | `bun run test:run`                      | all pass            |
| Lint       | `bun run lint`                          | exit 0              |

## Scope

**In scope** (create only):

- `src/app/api/disputes/[id]/__tests__/route.test.ts`
- `src/app/api/disputes/[id]/evidence/__tests__/route.test.ts`
- `src/app/api/disputes/[id]/state/__tests__/route.test.ts`
- `src/app/api/disputes/[id]/notes/__tests__/route.test.ts`
- `src/app/api/disputes/[id]/audit/__tests__/route.test.ts`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):

- ANY production code, including the PUT-before-verify ordering in
  `notes/route.ts` (see STOP conditions) and the state route's lack of a
  participant check.
- The two existing dispute test files.
- `[id]/resolve` — already tested.
- `DisputeStateMachine` and its own unit tests (if any).

## Git workflow

- Branch: `advisor/015-dispute-route-tests`
- One commit per test file; plain imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

Common setup for every file: mock `@/features/auth/utils/session` (per the
exemplar), `@/lib/api/with-request-logging` (identity), and `@/dal` with
`vi.fn()`s for exactly the DAL methods that file's route calls (listed
below). Build three session fixtures: unauthenticated (session fns resolve
null), regular user (`user-1`, not admin), admin (`admin-1`, admin flag set
however the session/user shape encodes it — read the helper first).

### Step 1: `[id]` GET tests

DAL mocks needed: `disputeDAL.getById`, `serviceBookingDAL.getById`,
`rentalDAL.getRentalDetailsById`.

1. unauthenticated → 401, `disputeDAL.getById` not called.
2. dispute not found → 404.
3. admin → 200 with the dispute; NO party lookups called.
4. rental dispute, caller is renter → 200.
5. rental dispute, caller neither renter nor owner → 403.
6. service dispute, caller is requester → 200.
7. service dispute, non-party → 403.
8. dispute with neither rentalId nor serviceBookingId → 400.

**Verify**: `bun run test:run src/app/api/disputes/[id]/__tests__/route.test.ts` → 8 pass.

### Step 2: evidence POST tests

Additional mocks: `@/services/vercel-blob` (`uploadToBlob`),
`@/lib/image/server` (`validateImageForProcessing`,
`processImageForUpload`). DAL: `disputeDAL.getById/checkEvidenceDeadline/countEvidenceByDisputeAndUser/createEvidence/createAuditLog`,
plus the party lookups. Body: `FormData` on the `NextRequest` (this route
reads `request.formData()` directly).

1. unauthenticated → 401.
2. non-party → 403, `createEvidence` not called.
3. dispute status `resolved` → 400 (message contains "resolved").
4. deadline expired → 400 with `deadline` in body.
5. existing count = 10 → 422.
6. text shorter than 10 chars → 400.
7. text > 5000 chars → 400.
8. neither file nor text → 400.
9. happy path (text, renter on a rental dispute) → 201; `createEvidence`
   called with `{ uploadedByRole: "renter", evidenceType: "text" }`;
   `createAuditLog` called with `actionType: "evidence_uploaded"`.

**Verify**: that file passes (9 tests).

### Step 3: state PATCH tests — the authorization pin

Use the REAL `DisputeStateMachine`. DAL mocks: `disputeDAL.getById/updateState/setAdditionalEvidenceDeadline/createAuditLog`,
`auditLogDAL.create`. Mock
`@/features/disputes/notifications/dispute-notifications`.

1. unauthenticated → 401.
2. body fails Zod (`newState: "bogus"`) → 400 with `details`.
3. dispute not found → 404.
4. **non-admin, structurally valid transition** (`open` → `under_review`,
   regular user) → 400, error matches
   `/Admin privileges required/`, `updateState` NOT called. ← the pin: if
   someone removes a state from `ADMIN_ONLY_STATES` or adds a non-admin
   target, this test forces a conscious decision.
5. admin, invalid transition (`closed` → `resolved`) → 400
   (`/final state/`), `updateState` not called.
6. admin, `open` → `under_review` → 200; `setAdditionalEvidenceDeadline`
   called (48h); `createAuditLog` with `actionType: "state_change"`;
   `auditLogDAL.create` with `action: "dispute.escalated"`.
7. admin, `open` → `evidence_requested`, notification mock rejects →
   still 200 (non-fatal).

**Verify**: that file passes (7 tests).

### Step 4: notes POST/PUT/DELETE tests

DAL mocks: `disputeDAL.getById/createInternalNote/updateInternalNote/getInternalNotesByDisputeId/deleteInternalNote/createAuditLog`.

1. POST unauthenticated → 401.
2. POST regular user → 403, `createInternalNote` not called.
3. POST admin, empty content → 400.
4. POST admin, valid → 201 + audit log `note_created`.
5. PUT regular user → 403.
6. PUT admin, `noteId` belonging to another dispute (mock
   `updateInternalNote` to return `{ disputeId: "other-dispute" }`) → 400.
   Add a code comment in the test noting the route updates **before**
   verifying membership — the test documents current behavior; the ordering
   itself is reported, not fixed, per STOP conditions.
7. DELETE admin, noteId not in `getInternalNotesByDisputeId` result → 404,
   `deleteInternalNote` not called.
8. DELETE admin, valid → 200 `{ success: true }` + audit log `note_deleted`.

**Verify**: that file passes (8 tests).

### Step 5: audit GET tests

DAL mocks: `disputeDAL.getById/getAuditLogsByDisputeId`. This route uses
`requireAdminResponse()` — the real helper decides 401 vs 403; assert the
status the real helper actually returns for each fixture (read the helper;
do not guess).

1. unauthenticated → 401, no DAL calls.
2. regular user → the helper's non-admin status (401 or 403 — assert what
   the real helper returns), no DAL calls.
3. admin, dispute missing → 404.
4. admin, found → 200 with the logs array.

**Verify**: that file passes (4 tests).

### Step 6: Full gates

**Verify**: `bun run type-check && bun run lint && bun run test:run` → exit 0;
`bun run test:run src/app/api/disputes` → ≥36 tests pass (incl. the two
pre-existing files).

## Test plan

This plan IS the test plan (Steps 1–5, ~36 tests). Pattern:
`src/app/api/rentals/[id]/approve/__tests__/route.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] The five new test files exist at the exact paths in Scope
- [ ] `bun run test:run src/app/api/disputes` → all pass; ≥34 new tests
- [ ] `grep -rn "vi.mock(\"@/lib/api/route-helpers\")" src/app/api/disputes/[id]` →
      no output (new files use the real helpers)
- [ ] `git diff --stat` shows NO production files changed
- [ ] `bun run type-check && bun run lint && bun run test:run` → exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A test you believe is correct fails because the **route** behaves
  differently than the table in "Current state" (e.g. the state route lets a
  non-admin transition something, the evidence cap doesn't fire) — that is a
  real bug; report it with the failing test, do not fix the route.
- The notes PUT cross-dispute test (Step 4.6) is the **known** wrinkle: the
  update commits before the membership check. Write the test to pin the 400
  response, and include the ordering observation in your completion report —
  do not reorder the route code.
- `getAuthenticatedUserResponse` cannot be driven through session-module
  mocks alone (e.g. it reads the DB for the admin flag) — report what it
  actually needs rather than falling back to mocking route-helpers.
- The body encoding for `parseFormData` routes can't be satisfied with a
  plain `NextRequest` (some helpers require specific content types) — check
  how the existing `[id]/resolve` test builds requests before reporting.

## Maintenance notes

- The state route's authorization rests on `ADMIN_ONLY_STATES` covering
  every transition target. If a future feature adds a participant-allowed
  transition (e.g. "participant closes own dispute"), the route then ALSO
  needs a party check (it currently never verifies the caller belongs to the
  dispute) — Step 3 test 4 will fail and force that conversation. That gap
  is documented here deliberately instead of pre-building the check.
- The notes PUT update-before-verify ordering: report from Step 4.6; fixing
  it is a one-line reorder a future plan (or human) can pick up with this
  test already in place.
- The old-pattern test file `disputes/__tests__/route.test.ts` is a
  conversion candidate the next time someone touches the dispute list/create
  route (same recipe plan 006 used for the approve route).
