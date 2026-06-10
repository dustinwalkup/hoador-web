# Plan 007: Replace router.refresh() with targeted React Query invalidation where a query cache exists

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c32982..HEAD -- src/features PERFORMANCE_AUDIT_PHASE2.md`
> Then re-run the inventory: `grep -rn "router.refresh()" src --include="*.tsx" --include="*.ts"` — at planning time this returned 14 hits in 10 files (listed below). If the list changed materially, reconcile before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (UX behavior changes; each site needs individual judgment)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `5c32982`, 2026-06-10

## Why this matters

The repo's own performance audit (`PERFORMANCE_AUDIT_PHASE2.md`, 2026-04-16) flagged two UX-latency drivers. The first — no server→client query hydration — is now **largely fixed**: six high-traffic pages (mailbox, both garage pages, explore, both rentals/services flow pages) use `HydrateClient` as of `5c32982`. The second still stands: 14 `router.refresh()` call sites use a full server re-render of the entire page tree as the state-sync mechanism after a mutation. On detail pages with many queries this adds 300-800ms of dead time per user action. Where the data the user is looking at lives in the React Query cache, a targeted `queryClient.invalidateQueries` refetches just that data. Where the data is RSC-rendered (no cache entry), `router.refresh()` is the _correct_ tool and must stay.

This plan also updates the stale §1 of `PERFORMANCE_AUDIT_PHASE2.md` so future audits don't re-report fixed work.

## Current state

The 14 call sites (10 files) at `5c32982`:

| File                                                                         | Context (verify on read)                  |
| ---------------------------------------------------------------------------- | ----------------------------------------- |
| `src/features/rentals/hooks/use-rental-mutations.ts` (~line 127)             | after rental action mutation              |
| `src/features/rentals/components/detail-page/rental-actions.tsx` (~93, 97)   | after instructions update / status change |
| `src/features/rentals/components/detail-page/retry-deposit-button.tsx` (~26) | after deposit retry                       |
| `src/features/users/hooks/use-profile.ts`                                    | after profile mutation                    |
| `src/features/services/components/service-booking-detail-client.tsx` (~328)  | refresh helper after booking actions      |
| `src/features/services/components/service-booking-flow.tsx` (~227)           | after booking created                     |
| `src/features/services/components/service-listing-form.tsx` (~173, 201)      | after listing create/update               |
| `src/features/services/components/service-provider-bio-form.tsx` (~57)       | after bio update                          |
| `src/features/services/components/admin-service-listings-review.tsx` (~205)  | after admin review mutation               |
| `src/features/admin/components/legal-document-upload-form.tsx` (~92)         | after upload                              |

Relevant infrastructure:

- Query keys: `src/features/rentals/hooks/use-rentals.ts` exports `rentalKeys`; `src/features/listings/hooks/garage-keys.ts` exports `garageKeys`; services features define their own (grep `queryKey` under `src/features/services/hooks/`).
- `useQueryClient` from `@tanstack/react-query` is the invalidation handle; existing usage examples: grep `invalidateQueries` under `src/features/` (multiple hits exist — follow their style).
- `PERFORMANCE_AUDIT_PHASE2.md` §1 ("No Server-to-Client Query Hydration") claims "Only 1 of ~30 dashboard pages uses HydrateClient" — stale; six pages use it now (`grep -rln "HydrateClient" src/app`).

## Commands you will need

| Purpose        | Command                         | Expected on success                        |
| -------------- | ------------------------------- | ------------------------------------------ |
| Typecheck      | `bun run type-check`            | exit 0                                     |
| Lint           | `bun run lint`                  | exit 0                                     |
| Targeted tests | `bun run test:run src/features` | all pass                                   |
| Full tests     | `bun run test:run`              | all pass                                   |
| Manual check   | `bun run dev`                   | flows listed in Test plan behave correctly |

## Scope

**In scope**:

- The 10 files listed above (modify only the refresh/invalidation logic and required imports)
- `PERFORMANCE_AUDIT_PHASE2.md` §1 (one stale-marker paragraph)

**Out of scope**:

- Adding `HydrateClient` to more pages — the high-traffic ones are done; diminishing returns.
- New query keys/hooks beyond what invalidation needs.
- The animation-delay and navigation-feedback findings in the same audit doc (separate concerns).
- Any server component or API route.

## Git workflow

- Branch: `advisor/007-router-refresh-to-query-invalidation` off `develop`
- One commit per file or per feature area; short imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Classify every call site

For each of the 14 sites, read the component and answer: **after this action, what changed data does the user see, and is it rendered from a `useQuery` hook (or a parent that is) — or from RSC props?**

Record the classification as a table in your final report:
`file:line | data the refresh targets | source (query cache / RSC props / both) | action (invalidate keys X,Y / keep refresh / both)`

Classification rules:

- Data rendered by a `useQuery` in the same client tree → replace with `queryClient.invalidateQueries({ queryKey: <the exact key factory call> })`.
- Data rendered by RSC (passed as props from a server `page.tsx`) → **keep** `router.refresh()`, add a one-line comment `{/* RSC-rendered data; router.refresh is intentional */}` style comment so the next audit doesn't re-flag it.
- Both → invalidate the query keys AND keep the refresh only if some visible data has no cache entry.

**Verify**: the table covers all 14 sites; no site is unclassified.

### Step 2: Apply the replacements

For each "query cache" site, swap `router.refresh()` for invalidation. Pattern (match existing `invalidateQueries` usage in the repo):

```tsx
const queryClient = useQueryClient();
// …in the success handler:
await queryClient.invalidateQueries({ queryKey: rentalKeys.detail(rentalId) });
```

Use the narrowest key that covers the visible data (a detail key, not a whole-feature prefix) unless the action affects lists too (e.g. status change → also invalidate the list key for the affected status tab). When a mutation hook already exists for the action (e.g. `use-rental-mutations.ts`), put the invalidation in the hook's `onSuccess`, not in the component.

Remove now-unused `useRouter` imports; keep them where `router` is still used for navigation.

**Verify after each file**: `bun run type-check` → exit 0; `bun run test:run src/features/<area>` → existing component tests pass (some assert on `router.refresh` mocks — update those assertions to the new invalidation behavior).

### Step 3: Mark the stale audit section

In `PERFORMANCE_AUDIT_PHASE2.md`, at the top of §1 ("No Server-to-Client Query Hydration"), add:

```markdown
> **Status update (2026-06): largely resolved.** HydrateClient is now wired on
> mailbox, listings/rentals, listings/services, explore, and both
> rentals/services flow pages. Remaining unhydrated pages are low-traffic
> detail/admin pages. §2 (router.refresh) addressed by plans/007.
```

**Verify**: `grep -n "Status update (2026-06)" PERFORMANCE_AUDIT_PHASE2.md` → match.

### Step 4: Manual smoke check

Run `bun run dev` and exercise at least: (a) a rental action from the rentals flow page (e.g. approve/deny in `rental-actions.tsx`'s flow), (b) a service listing edit, (c) the deposit retry button if reachable. After each action the visible state must update **without a full-page reload feel** and without stale data. If you cannot reach a flow locally (needs Stripe data), note it as untested in the report rather than skipping silently.

## Test plan

- Update existing component/hook tests that mock `router.refresh` to assert `invalidateQueries` is called with the chosen keys instead (search: `grep -rln "refresh" src/features --include="*.test.tsx" --include="*.test.ts"`).
- For `use-rental-mutations.ts`, add/extend a hook test asserting `onSuccess` invalidates the expected keys (model on any existing hook test under `src/features/rentals/hooks/__tests__/` — check for one first).
- Full gate: `bun run test:run` → green.

## Done criteria

- [ ] Classification table for all 14 sites delivered in the report
- [ ] Every "query cache" site uses `invalidateQueries` with explicit keys; every kept `router.refresh()` has an intent comment
- [ ] `grep -rn "router.refresh()" src --include="*.tsx" --include="*.ts"` returns only sites with an adjacent intent comment
- [ ] `PERFORMANCE_AUDIT_PHASE2.md` §1 carries the status-update note
- [ ] `bun run type-check`, `bun run lint`, `bun run test:run` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A call site's visible data source is genuinely ambiguous after reading the component AND its parent page — leave that site unchanged, mark it "ambiguous" in the classification table, and continue (report it; don't guess).
- Replacing a refresh breaks a flow in the manual smoke check and the fix isn't an obviously-missing query key — revert that site to `router.refresh()` with a comment and report.
- The query-key factories don't cover the data a site needs (would require designing new keys for an existing endpoint) — keep the refresh, report the gap.

## Maintenance notes

- New mutations should invalidate keys in their hook's `onSuccess` from day one; `router.refresh()` in a client component is a review flag unless commented as RSC-intentional.
- If/when the remaining RSC-prop pages get hydrated, the kept `router.refresh()` sites become candidates for the same swap — the classification table is the worklist.
- The other PERFORMANCE_AUDIT_PHASE2 items (no navigation progress indicator; animation delays fighting streaming) remain open and were deliberately not bundled here.
