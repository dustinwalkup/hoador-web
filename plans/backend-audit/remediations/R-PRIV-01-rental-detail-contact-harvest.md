# Plan R-PRIV-01: Strip counterparty contact info and gate pickup/delivery addresses on rental detail

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/dal/rentals.dal.ts src/app/api/rentals/[id]/route.ts src/features/rentals/lib/form-schema.ts src/features/rentals/services/rental-quote.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 · **Effort**: M · **Risk**: MED · **Depends on**: none
- **Category**: security
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

`GET /api/rentals/[id]` returns the counterparty's email, phone, and the
owner's full street address to any party of a rental request, at every
status including `pending`, `denied` and `cancelled`. Becoming a party costs
nothing (any string satisfies `paymentMethodId`, and a pending request can be
cancelled for free), so any verified account can script request → read →
cancel against every listing in a community and harvest owners' home
addresses, emails and phones at scale. This is the audit's one CRITICAL
finding (PRIV-01). The fix replaces an unguarded object spread with an
explicit allowlist so no future `RentalDetails` field can leak the same way.

## Current state

- `src/dal/rentals.dal.ts` — `getRentalDetailsById` (interface `:243-329`,
  request branch `:2204-2394`, rental branch `:2470-2600`) returns
  `ownerEmail`, `ownerPhone`, `renterEmail`, `renterPhone`, `pickupAddress`
  (owner's primary address) and `deliveryAddress` (renter's) in both
  branches. **The DAL is out of scope** — internal callers (PDF generation,
  dispute creation, notifications) legitimately need the full row; only the
  two consumers that serialize to a client response need gating.
- `src/app/api/rentals/[id]/route.ts:118,174-185` checks party membership
  only, then spreads the whole row:
  ```ts
  if (!isAdmin && data.renterId !== userId && data.ownerId !== userId) { ... }
  return Response.json({
    ...data,
    startDate: toWallClock(data.startDate, { dateOnly: true }),
    endDate: toWallClock(data.endDate, { dateOnly: true }),
    viewerRole, earnings: buildEarningsPreview(viewerRole, data),
    agreement, dispute: dispute ?? null,
  });
  ```
  `viewerRole` (`"renter" | "owner" | "admin"`) is already computed above
  this call from `data.renterId`/`data.ownerId` vs. `userId`.
- `rentalStatusEnum` (`src/db/schemas/_enums.ts:25-33`):
  `["pending","approved","active","completed","cancelled","overdue","denied"]`.
  "Post-approval" for the address gate = `{"approved","active","completed"}`.
- Every other `RentalDetails` field (names, ratings, dates, amounts,
  instructions, `paymentFailureReason`, etc.) passes through unchanged —
  `paymentFailureReason` is a separate finding (PRIV-08), not this plan.
- Web UI: `src/features/rentals/components/detail-page/rental-details-server.tsx:28`
  calls the DAL directly and hands the raw row down to client components
  (`rental-content.tsx` → `rental-user-info.tsx`, which puts the email/phone
  into a `UserCard` with `showContactInfo={true}`). **This is in scope.** The
  web UI is still deployed, and a server component serializes every prop it
  passes to a client component into the page's RSC payload. So even with the
  API route fixed, an attacker could create a request via the API and open
  `/dashboard/rental/<id>` in a browser to read the same email, phone and
  address. The web page must receive the same mapped object as the API (Step 2b).
  _(Lead auditor correction to the first draft, which had left the web page out
  of scope; without this step PRIV-01 stays exploitable.)_
- Mobile: `hoador-mobile/src/api/contract/rental-detail.contract.ts:21-25`
  deliberately never parses the four email/phone fields. `pickupAddress`/
  `deliveryAddress` are already `z.string().nullable().optional()`
  (`:118,121`), and `rental-detail-screen.tsx:339-351` renders each only when
  present, with no role check today.

## Commands you will need

| Purpose   | Command                                        |
| --------- | ---------------------------------------------- |
| Install   | `bun install`                                  |
| Typecheck | `bun run type-check`                           |
| Lint      | `bun run lint`                                 |
| Tests     | `bun run test:run <path>` / `bun run test:run` |

## Scope

**In scope**:

- `src/features/rentals/lib/rental-detail-response.ts` (create)
- `src/features/rentals/lib/__tests__/rental-detail-response.test.ts` (create)
- `src/app/api/rentals/[id]/route.ts` (modify: use the new mapper)
- `src/app/api/rentals/[id]/__tests__/route.test.ts` (extend)
- `src/features/rentals/components/detail-page/rental-details-server.tsx` (modify: pass the mapped object down)
- `src/features/rentals/components/detail-page/rental-content.tsx` and
  `rental-user-info.tsx` (modify only as far as the prop types require; email/phone become absent)

**Out of scope**:

- `src/dal/rentals.dal.ts` — keeps returning full data for internal callers.
- Any other web page redesign. The web UI is retiring; only stop the leak.
- BIZ-08 (no visibility/status check before a rental request exists, which is
  what makes "becoming a party" free) — mention only, separate finding.
- `form-schema.ts` `paymentMethodId` validation — BIZ-08-adjacent, not this plan.
- `src/app/api/disputes/[id]/route.ts` / `.../evidence/route.ts` — also call
  `getRentalDetailsById` but serve their own participant-view projection.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes uncommitted
for the maintainer to review and commit.

## Steps

### Step 1: Create the response mapper

Create `src/features/rentals/lib/rental-detail-response.ts`:

```ts
import type { RentalDetails } from "@/dal/rentals.dal";

const ADDRESS_VISIBLE_STATUSES = new Set(["approved", "active", "completed"]);
export type RentalViewerRole = "renter" | "owner" | "admin";

/** Admins keep the full row. Everyone else loses *Email/*Phone always, and
 *  each street address only to the party who needs it, only once the
 *  request is no longer just a pending ask (PRIV-01). */
export function toRentalDetailResponse(
  data: RentalDetails,
  viewerRole: RentalViewerRole,
): Omit<
  RentalDetails,
  "renterEmail" | "renterPhone" | "ownerEmail" | "ownerPhone"
> {
  if (viewerRole === "admin") return data;
  const unlocked = ADDRESS_VISIBLE_STATUSES.has(data.status);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { renterEmail, renterPhone, ownerEmail, ownerPhone, ...rest } = data;
  return {
    ...rest,
    pickupAddress:
      viewerRole === "renter" && unlocked ? data.pickupAddress : undefined,
    deliveryAddress:
      viewerRole === "owner" && unlocked ? data.deliveryAddress : undefined,
  };
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 2: Wire the mapper into the route

In `src/app/api/rentals/[id]/route.ts`, import `toRentalDetailResponse` and
replace `...data` in the final `Response.json` call with
`...toRentalDetailResponse(data, viewerRole)`. Keep the later
`startDate`/`endDate` overrides after the spread so they still win.

**Verify**: `bun run type-check` → exit 0.

### Step 2b: Apply the same mapper to the web detail page

In `rental-details-server.tsx`, after the existing party check, compute
`viewerRole` the same way the route does: `"renter"` if `renterId === userId`,
`"owner"` if `ownerId === userId`. Pass `toRentalDetailResponse(rentalDetails, viewerRole)`
down to the client components instead of the raw `rentalDetails`. Then widen
the prop types in `rental-content.tsx` / `rental-user-info.tsx` to accept the
mapped type, where the email/phone fields are absent.

Check how `src/components/user-card.tsx` renders a missing email/phone. If it
would print an empty row or the text "undefined", pass
`showContactInfo={false}` in `rental-user-info.tsx` instead of relying on absence.

**Verify**:

- `bun run type-check` → exit 0.
- `grep -n "toRentalDetailResponse" src/features/rentals/components/detail-page/rental-details-server.tsx` → one match.

### Step 3: Add tests

`rental-detail-response.test.ts` — pure-function table test, no mocks: for
every `{status, viewerRole}` combination assert (a) no `renterEmail`/
`renterPhone`/`ownerEmail`/`ownerPhone` in the output; (b) `pickupAddress`
present only for `renter` at `approved`/`active`/`completed`; (c)
`deliveryAddress` mirrors that for `owner`; (d) `admin` returns the input
object unchanged.

Extend `route.test.ts` (already mocks `@/features/auth/utils/session` and
`@/dal` — see its existing structure) with a `pending`-status case asserting
the serialized body has no `@` in any string field and no `ownerPhone`/
`renterPhone`/`pickupAddress`/`deliveryAddress`.

**Verify**: `bun run test:run src/features/rentals/lib/__tests__/rental-detail-response.test.ts src/app/api/rentals/\[id\]/__tests__/route.test.ts` → all pass.

## Test plan

- New: `rental-detail-response.test.ts` — 7 statuses × 3 roles table test.
- Extended: `route.test.ts` — end-to-end body check for `pending` and
  `approved`, both roles. Model DAL mocking on the file's existing tests.
- Verification: `bun run test:run` → all pass, including new/extended cases.

## Done criteria

- [ ] `bun run type-check` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun run test:run` exits 0
- [ ] `grep -n "\.\.\.data" src/app/api/rentals/\[id\]/route.ts` returns no matches
- [ ] `rental-details-server.tsx` passes the mapped object, not the raw DAL row, to client components (grep from Step 2b)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` ("Execution order & status")

## STOP conditions

- `RentalDetails` (`src/dal/rentals.dal.ts:243-329`) has materially different
  fields than described — re-derive the allowlist from the live interface.
- `rentalStatusEnum`'s values differ from the list above — re-check with
  `grep -n "rentalStatusEnum" -A 10 src/db/schemas/_enums.ts`.
- `viewerRole` is no longer computed before the final `Response.json` call.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

The shipped app never reads the four email/phone fields (confirmed by the
mobile contract's own comment, `rental-detail.contract.ts:21-25`, and by Zod
stripping unparsed fields), so removing them is a pure size reduction with
zero behavior change. `pickupAddress`/`deliveryAddress` are already optional
in the contract and already rendered conditionally with no role check
(`rental-detail-screen.tsx:339-351`): after this fix the renter still sees
"Pickup from `<address>`" once approved (just absent, not present-but-unused,
before that); the owner starts seeing "Delivery to `<address>`" only once
approved instead of at every status. Neither is a contract break — the field
was always optional and the screen already tolerates its absence. No
companion mobile change is required.

## Maintenance notes

- This mapper subtracts four named fields from `...rest`. A future sensitive
  `RentalDetails` addition (another PII field, a Stripe id) will pass through
  by default — convert to a positive (inclusion) allowlist at that point.
- The web detail page still leaks the same four fields into its
  server-rendered props (out of scope here). Revisit when that UI is retired
  or rebuilt.
- BIZ-08 (no visibility/status check before a rental request can be created)
  is what makes "becoming a party" free; this plan does not fix that half of
  the exploit chain. Track it separately.
