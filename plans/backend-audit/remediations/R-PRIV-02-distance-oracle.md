# Plan R-PRIV-02: Coarsen server-side distances to defeat trilateration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat 21bdc61..HEAD -- src/dal/listing.dal.ts src/dal/neighborhood-needs.dal.ts src/lib/utils/geo.utils.ts`
> On any change, compare "Current state" below against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 · **Effort**: M · **Risk**: MED · **Depends on**: none
- **Category**: security
- **Planned at**: commit `21bdc61`, 2026-09-23

## Why this matters

Listing search and the neighborhood-needs feed return the exact distance
(meters-level precision) between the viewer's home and the target's home.
Because a viewer can move their own reference point at will via
`PATCH /api/profile`, this is a distance oracle: three queries from three
self-chosen points trilaterate any lister's or need-poster's rooftop to
within about a metre, and the target is never notified. Rounding the
_displayed_ number is not sufficient — an attacker who controls one input
point continuously (their own address) can still recover near-exact distance
by bisecting where a rounded value flips. The fix must coarsen the
_reference coordinate_ itself, not just the output.

## Current state

- `src/dal/listing.dal.ts:177-186` (`buildDistanceSelectFields`) computes
  distance in SQL via PostGIS, aliased `distance_miles`:
  ```ts
  calculatedDistance: sql<number>`
        ST_Distance(
          ST_Point(${userLocation.longitude}::float, ${userLocation.latitude}::float)::geography,
          ST_Point(${userAddresses.longitude}::float, ${userAddresses.latitude}::float)::geography
        ) / 1609.34
      `.as("distance_miles"),
  ```
  `userAddresses` here is the **owner's** joined address row. Sort-by-distance
  (`buildOrderByClause:190-224`, the `"distance"` case) orders on the same
  `distance_miles` SQL alias. The raw value is serialized unrounded at
  `:988-1009` as `distanceMiles` on every search result.
- `src/dal/neighborhood-needs.dal.ts` computes distance in JS with a plain
  haversine on the **requester's** raw lat/lng, in two places: the feed row
  mapper (`:392-412`, `requesterLat`/`requesterLng` off a raw SQL row) and the
  single-need detail lookup (`:526-541`, via `getUserPrimaryLocation`). Both
  call `haversineMiles(viewerLocation, {latitude, longitude})` on the raw pair.
- `src/lib/utils/geo.utils.ts` — `haversineMiles(a, b)` (`:21-32`, pure) and
  `formatDistanceMiles` (`:39-46`, display-only; does not protect the API).
- Both DAL files already have the raw coordinates in scope where distance is
  computed — no extra query needed.
- Out of scope: `src/app/api/profile/route.ts:93-96` / `user.dal.ts:634-678`
  (`updateUserPrimaryAddress`) are how an attacker moves their own point, but
  the fix coarsens the _target's_ point, not address-change throttling
  (optional, below).

## Commands you will need

| Purpose   | Command                                        |
| --------- | ---------------------------------------------- |
| Install   | `bun install`                                  |
| Typecheck | `bun run type-check`                           |
| Lint      | `bun run lint`                                 |
| Tests     | `bun run test:run <path>` / `bun run test:run` |

## Scope

**In scope**: `src/lib/utils/geo-privacy.ts` (create); `src/lib/utils/__tests__/geo-privacy.test.ts`
(create); `src/dal/listing.dal.ts` (snap owner coordinates before
`ST_Distance`); `src/dal/neighborhood-needs.dal.ts` (snap requester
coordinates before `haversineMiles`, both call sites); existing DAL tests
for those two files, extended if they cover distance.

**Out of scope**: `src/app/api/profile/route.ts` / `user.dal.ts`
`updateUserPrimaryAddress` (no throttle added — optional follow-up, below);
`geo.utils.ts`'s `haversineMiles` itself (stays a pure two-point function;
only its inputs change); `formatDistanceMiles` or mobile display formatting.

## Git workflow

Work directly on `develop`. Do not commit or push — leave changes uncommitted
for the maintainer to review and commit.

## Steps

### Step 1: Create the snapping/bucketing helper

Create `src/lib/utils/geo-privacy.ts`:

```ts
import type { LatLng } from "./geo.utils";

/** ~400m at mid-latitudes — coarse enough to defeat rooftop trilateration. */
const GRID_DEGREES = 0.0036;

/** Deterministic, not re-rolled per request, so repeated queries can't be
 *  averaged to cancel the offset out — a given target always snaps the same. */
function seededFraction(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 10000) / 10000;
}

/** Snap a TARGET's coordinates to a stable grid cell, salted by their own
 *  user id, so trilateration converges on the cell, never the rooftop. */
export function snapCoordinatesForPrivacy(
  lat: number,
  lng: number,
  targetUserId: string,
): LatLng {
  const latOffset = seededFraction(`${targetUserId}:lat`) * GRID_DEGREES;
  const lngOffset = seededFraction(`${targetUserId}:lng`) * GRID_DEGREES;
  return {
    latitude: Math.floor(lat / GRID_DEGREES) * GRID_DEGREES + latOffset,
    longitude: Math.floor(lng / GRID_DEGREES) * GRID_DEGREES + lngOffset,
  };
}

/** Round up to 0.5 mi steps (min 0.5) — defense in depth + a nicer value. */
export function bucketDistanceMiles(miles: number): number {
  return Math.max(0.5, Math.ceil(miles / 0.5) * 0.5);
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 2: Apply it in the neighborhood-needs DAL (JS path)

In both call sites (`:392-412` feed mapper, `:526-541` detail lookup), snap
the requester's coordinates before calling `haversineMiles`, then bucket the
result:

```ts
const snapped =
  requesterLat != null && requesterLng != null
    ? snapCoordinatesForPrivacy(
        Number(requesterLat),
        Number(requesterLng),
        need.createdByUserId,
      )
    : null;
const distanceMiles =
  viewerLocation && snapped
    ? bucketDistanceMiles(haversineMiles(viewerLocation, snapped))
    : null;
```

Use the correct target-user-id variable in scope at each call site (confirm
the exact field name in context before editing).

**Verify**: `bun run type-check` → exit 0.

### Step 3: Apply it in the listing DAL (SQL path)

In `buildDistanceSelectFields` (`:150-186`), snap the **owner's** coordinates
to the same 400m grid inside the SQL expression, before `ST_Distance`, using
floor-based rounding (no per-owner salt in SQL — see Maintenance notes for
why):

```sql
ST_Point(
  floor(${userAddresses.longitude}::float / 0.0036) * 0.0036 + 0.0018,
  floor(${userAddresses.latitude}::float / 0.0036) * 0.0036 + 0.0018
)::geography
```

Replace only the second `ST_Point(...)` argument (the owner's point); leave
the viewer's `ST_Point` untouched — coarsening the viewer's own point adds no
privacy (they know their own address) and only degrades accuracy. After the
SQL change, bucket the value in JS in `transformedListings`
(`:988-993`, where `distanceMiles` is assigned from `calculatedDistance`)
using `bucketDistanceMiles`. Sort-by-distance needs no change — it already
orders on the `distance_miles` alias, which now holds the coarse value.

**Verify**: `bun run type-check` → exit 0.

### Step 4: Tests

`geo-privacy.test.ts`: `snapCoordinatesForPrivacy` is deterministic (same
inputs → same output); two points 10m apart, same target id, snap
identically when both fall in the same cell; different target ids produce
different offsets for the same raw point. `bucketDistanceMiles` rounds up to
the next 0.5 and never returns below 0.5. Extend/add a DAL-level test per
file: two distinct viewer addresses 10m apart produce identical
`distanceMiles` against the same target.

**Verify**: `bun run test:run src/lib/utils/__tests__/geo-privacy.test.ts` and the extended DAL tests → all pass.

## Test plan

Covered by Step 4 above: new `geo-privacy.test.ts`, plus whichever existing
`listing.dal.test.ts` / `neighborhood-needs.dal.test.ts` cases assert on
`distanceMiles` (update to expect bucketed values; add the "10m apart,
identical result" case to each). Verification: `bun run test:run` → all pass.

## Done criteria

- [ ] `bun run type-check` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun run test:run` exits 0
- [ ] `distanceMiles` in both DAL outputs is always a multiple of 0.5 (or
      `null`), verified by the new tests
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md` ("Execution order & status")

## STOP conditions

- `buildDistanceSelectFields` or the `ST_Point` call shape differs materially
  from the excerpt (e.g. coordinates come from a different join) — re-verify
  the owner-address alias before editing raw SQL.
- The needs DAL's raw-row field names differ from what's described — confirm
  with `sed -n '380,420p' src/dal/neighborhood-needs.dal.ts` before editing.
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

No `distanceMiles` (or similarly-named) field was found in `hoador-mobile/src`
at audit time — the feature may not be built on mobile yet, or ships under a
different name. Either way `distanceMiles` stays a JSON `number`, so any
future mobile consumer, and web's existing `formatDistanceMiles`, keep
working unchanged — only the precision changes. No companion mobile change
is required; re-run `grep -rn "distanceMiles" hoador-mobile/src` before
shipping to confirm this is still true.

## Maintenance notes

- The SQL path omits the per-owner salt the JS path applies (Step 3): a
  stable hash offset in raw SQL is fragile per-row. Floor-only snapping still
  bounds trilateration to the ~400m cell; a per-owner SQL offset (mirroring
  `seededFraction`) is a reasonable follow-up, not required here.
- `GRID_DEGREES` can't be shared into the raw SQL literal in `listing.dal.ts`
  — keep the two in sync by hand and comment each pointing at the other.
- Optional, not implemented here: rate-limit or audit `PATCH /api/profile`
  address changes — the attacker's query-generation lever, even once the
  oracle itself is coarse.
