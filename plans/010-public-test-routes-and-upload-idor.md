# Plan 010: Close the public test routes and the profile-image delete IDOR

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ad0306e..HEAD -- src/app/api/test-serp src/app/api/test-upload src/app/test-image-upload src/app/api/profile/upload src/proxy.ts src/lib/utils/profile-upload.ts src/features/onboarding/components/profile-image-upload.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `ad0306e`, 2026-06-10

## Why this matters

Two separate, small security holes:

1. **`/api/test-serp` and `/api/test-upload` are publicly reachable in
   production.** Both are listed in the middleware's `PUBLIC_API_ROUTES`
   (`src/proxy.ts:40-41`) and neither route file checks auth or environment.
   Any anonymous actor can upload images into the project's Vercel Blob
   storage (`test-upload`) or burn the `SERP_API_KEY` quota with arbitrary
   search queries (`test-serp`). These are developer tools — their only caller
   is the dev page `src/app/test-image-upload/page.tsx` — yet they ship
   ungated, unlike the e2e routes under `/api/test/*` which fail closed.
2. **Profile-image DELETE is an IDOR.** `DELETE /api/profile/upload?pathname=…`
   requires authentication but the only authorization check is
   `pathname.startsWith("profiles/")` — so any authenticated user can delete
   any other user's profile image blob by guessing/observing its pathname
   (pathnames are `profiles/<timestamp>-<original-filename>.jpg`, visible in
   every avatar URL).

## Current state

Files:

- `src/proxy.ts:38-43` — middleware `PUBLIC_API_ROUTES` list (excerpt below).
- `src/app/api/test-serp/route.ts` — ~590-line dev tool calling the SERP API
  with `process.env.SERP_API_KEY` (line 320); handler exported at the end via
  `withRequestLogging(getHandler, "GET /api/test-serp")`. No auth, no env
  guard.
- `src/app/api/test-upload/route.ts` — 74-line dev tool; unauthenticated POST
  uploads a processed image to Vercel Blob under `test-uploads/…`. No auth, no
  env guard.
- `src/app/test-image-upload/page.tsx` — `"use client"` dev page (image
  analysis + price research playground); the only caller of `/api/test-serp`
  (lines 125, 155). No production gate.
- `src/app/api/profile/upload/route.ts` — POST (upload, lines 18-117) and
  DELETE (lines 119-158) for profile images.
- `src/lib/utils/profile-upload.ts` — client helpers `uploadProfileImage` /
  `deleteProfileImage` (fetches the route).
- `src/features/onboarding/components/profile-image-upload.tsx:126-149` — the
  only UI calling `deleteProfileImage`, passing the pathname derived from the
  currently displayed image URL.
- `src/app/api/test/last-email/route.ts` — the **exemplar guard** for
  test-only routes (excerpt below).

### Excerpt 1 — PUBLIC_API_ROUTES (src/proxy.ts:37-43)

```ts
// Define public API routes that should not be protected
const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/test-serp",
  "/api/test-upload",
  "/api/profile",
];
```

(`/api/auth` and `/api/profile` stay — their route handlers own auth
internally, per the architecture rule that API routes own auth.)

### Excerpt 2 — the exemplar env guard (src/app/api/test/last-email/route.ts:23-26)

```ts
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_TEST !== "1") {
    return new Response(null, { status: 404 });
  }
```

Note: `/api/test/*` routes are **e2e-only** (require `E2E_TEST=1`). The two
routes in this plan are **dev tools** used during normal `bun run dev`, so
their guard is production-only (`NODE_ENV === "production"` → 404), NOT the
`E2E_TEST` check — otherwise the dev workflow breaks.

### Excerpt 3 — the IDOR (src/app/api/profile/upload/route.ts:119-154, abridged)

```ts
async function deleteHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }

    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get("pathname");
    if (!pathname) { /* 400 */ }

    // Validate that this is a profile image path
    if (!pathname.startsWith("profiles/")) { /* 400 */ }

    await deleteFromBlob(pathname);          // ← no ownership check
    /* 200 */
```

### Excerpt 4 — POST filename generation (src/app/api/profile/upload/route.ts:67-76)

```ts
// Generate unique filename with .jpg extension
const timestamp = Date.now();
const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
const filename = `profiles/${timestamp}-${sanitizedName.replace(/\.[^/.]+$/, ".jpg")}`;

// Get current user's profile image before upload (for cleanup)
const currentProfileImageUrl = user.profileImageUrl;
```

`authResult` destructures to `{ user, userId, isAdmin }` — `user.profileImageUrl`
and `userId` are already available in both handlers' scope.

### Client flow constraint (why DELETE can't just match `user.profileImageUrl`)

During onboarding, `profile-image-upload.tsx` lets a user upload an image and
then remove it **before the profile is saved** — at that moment the blob
exists but `user.profileImageUrl` in the DB may still be the old value (or
null). So the ownership rule must accept:

- any pathname under the caller's own user-scoped prefix (new uploads), OR
- the exact pathname of the caller's current `user.profileImageUrl` (legacy
  flat-path images uploaded before this plan).

That requires the POST to start writing user-scoped paths
(`profiles/<userId>/<timestamp>-<name>.jpg`).

## Commands you will need

| Purpose    | Command                                | Expected on success |
| ---------- | -------------------------------------- | ------------------- |
| Install    | `bun install`                          | exit 0              |
| Typecheck  | `bun run type-check`                   | exit 0              |
| Tests      | `bun run test:run src/app/api/profile` | all pass            |
| Full suite | `bun run test:run`                     | all pass            |
| Lint       | `bun run lint`                         | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `src/app/api/test-serp/route.ts`
- `src/app/api/test-upload/route.ts`
- `src/app/test-image-upload/layout.tsx` (create)
- `src/proxy.ts` (remove two array entries only)
- `src/app/api/profile/upload/route.ts`
- `src/app/api/profile/upload/__tests__/route.test.ts` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `src/app/api/test/*` — already correctly guarded.
- `src/lib/utils/profile-upload.ts` and
  `src/features/onboarding/components/profile-image-upload.tsx` — the client
  flow keeps working unchanged (it deletes pathnames the same user just
  uploaded, which fall under the new prefix rule, or the user's current image,
  which matches the fallback).
- `src/services/vercel-blob.ts` — `uploadToBlob`/`deleteFromBlob` are fine.
- Existing blobs / any data migration — legacy flat-path images keep working
  via the exact-match fallback; do not attempt to move blobs.
- Rate limiting on uploads — known gap, deliberately deferred (needs an infra
  decision; see `plans/README.md` rejected list).

## Git workflow

- Branch: `advisor/010-public-test-routes-and-upload-idor`
- Commit per step; plain imperative messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Gate the two dev routes against production

At the top of `getHandler` in `src/app/api/test-serp/route.ts` and `postHandler`
in `src/app/api/test-upload/route.ts` (first statement inside the function,
before any parsing):

```ts
if (process.env.NODE_ENV === "production") {
  return new Response(null, { status: 404 });
}
```

**Verify**: `grep -n 'NODE_ENV === "production"' src/app/api/test-serp/route.ts src/app/api/test-upload/route.ts`
→ one hit in each file. `bun run type-check` → exit 0.

### Step 2: Gate the dev page

Create `src/app/test-image-upload/layout.tsx` (server component — the page
itself is `"use client"`, so the gate goes in a layout):

```tsx
import { notFound } from "next/navigation";

export default function TestImageUploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 3: Remove the middleware bypass entries

In `src/proxy.ts`, delete the `"/api/test-serp"` and `"/api/test-upload"`
lines from `PUBLIC_API_ROUTES` (Excerpt 1). Leave `"/api/auth"` and
`"/api/profile"` exactly as they are.

**Verify**: `grep -n "test-serp\|test-upload" src/proxy.ts` → no output.

### Step 4: User-scoped upload paths (POST)

In `src/app/api/profile/upload/route.ts`, change the filename generation
(Excerpt 4) to include the authenticated user's id. The handler already has
`const { user } = authResult;` — destructure `userId` as well
(`const { user, userId } = authResult;`):

```ts
const filename = `profiles/${userId}/${timestamp}-${sanitizedName.replace(/\.[^/.]+$/, ".jpg")}`;
```

The old-image cleanup block below it (lines 78-100) is unchanged — it derives
the old pathname from `user.profileImageUrl` and works for both legacy and
new paths.

**Verify**: `bun run type-check` → exit 0.

### Step 5: Ownership check on DELETE

In `deleteHandler`, after the existing `pathname.startsWith("profiles/")`
check and before `deleteFromBlob(pathname)`, add (destructure
`const { user, userId } = authResult;` at the top of the handler):

```ts
// Ownership: a user may delete only their own uploads — anything under
// their user-scoped prefix, or the exact blob backing their current
// profile image (legacy flat paths from before user-scoped uploads).
let currentImagePathname: string | null = null;
if (user.profileImageUrl) {
  try {
    currentImagePathname = new URL(user.profileImageUrl).pathname.replace(
      /^\//,
      "",
    );
  } catch {
    currentImagePathname = null;
  }
}
const ownsBlob =
  pathname.startsWith(`profiles/${userId}/`) ||
  (currentImagePathname !== null && pathname === currentImagePathname);
if (!ownsBlob) {
  return NextResponse.json(
    { error: "You can only delete your own profile image" },
    { status: 403 },
  );
}
```

**Verify**: `bun run type-check` → exit 0.

### Step 6: Route tests

Create `src/app/api/profile/upload/__tests__/route.test.ts`. **Pattern**:
model on `src/app/api/rentals/[id]/approve/__tests__/route.test.ts` — mock the
session layer (`@/features/auth/utils/session`) and external services, run the
REAL `@/lib/api/route-helpers` (this is the repo's route-test convention; see
CLAUDE.md). Additionally mock:

- `@/services/vercel-blob` → `{ uploadToBlob: vi.fn(), deleteFromBlob: vi.fn() }`
- `@/lib/image/server` → validate/process/metadata fns (POST tests only)
- `@/lib/api/with-request-logging` → identity wrapper (copy from the exemplar)

Note: the real `getAuthenticatedUserResponse()` resolves the user via the
session module — check what `@/features/auth/utils/session` exports that it
calls (read `src/lib/api/route-helpers.ts` around `getAuthenticatedUserResponse`)
and mock those functions to return a user object with
`{ id: "user-1", profileImageUrl: "https://blob.example.com/profiles/111-old.jpg" }`.

DELETE cases (the point of this plan):

1. unauthenticated → 401, `deleteFromBlob` not called.
2. `pathname=profiles/user-1/123-me.jpg` (own prefix) → 200,
   `deleteFromBlob` called with that pathname.
3. `pathname=profiles/111-old.jpg` (exact match of own current image) → 200.
4. `pathname=profiles/999-victim.jpg` (someone else's legacy path) → **403**,
   `deleteFromBlob` NOT called.
5. `pathname=profiles/user-2/123-other.jpg` (someone else's prefix) → **403**.
6. `pathname=listings/123.jpg` → 400 (existing prefix check still first).

POST cases:

7. unauthenticated → 401.
8. authenticated upload → 200 and `uploadToBlob` called with a filename
   matching `/^profiles\/user-1\/\d+-/`.

**Verify**: `bun run test:run src/app/api/profile` → all pass (8 new tests).

### Step 7: Full gates

**Verify**: `bun run type-check && bun run lint && bun run test:run` → exit 0.

## Test plan

Covered in Step 6. No tests for the two dev routes beyond the guard greps —
they are dev tools scheduled to stay out of production builds; a route test
asserting the 404 in production would have to fake `NODE_ENV`, which vitest
sets to `test`. The grep + code review suffices.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "test-serp\|test-upload" src/proxy.ts` → no output
- [ ] `grep -c 'NODE_ENV === "production"' src/app/api/test-serp/route.ts` → 1;
      same for `src/app/api/test-upload/route.ts`
- [ ] `src/app/test-image-upload/layout.tsx` exists and calls `notFound()`
      under production
- [ ] `grep -n "profiles/\${userId}/" src/app/api/profile/upload/route.ts`
      → hits in both POST (filename) and DELETE (ownership check)
- [ ] `bun run test:run src/app/api/profile` → all pass, incl. the two 403
      IDOR cases
- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the "Current state" locations doesn't match the excerpts.
- You find production code (anything outside `src/app/test-image-upload/`)
  calling `/api/test-serp` or `/api/test-upload`
  (check: `grep -rn "test-serp\|test-upload" src --include="*.ts" --include="*.tsx" | grep -v "src/app/api/test-" | grep -v proxy.ts`)
  — that would mean one of them is a production feature in disguise and needs
  auth instead of a 404 gate.
- `getAuthenticatedUserResponse()`'s user object turns out not to expose
  `profileImageUrl` (check its return type in `src/lib/api/route-helpers.ts`)
  — the fallback match needs a different source; report rather than querying
  the DAL ad hoc.
- Removing the proxy entries breaks the dev page in development (e.g. the
  middleware starts redirecting `/api/test-serp` fetches to `/login` for a
  logged-in dev) — report what the middleware actually did; do not add the
  entries back silently.

## Maintenance notes

- New profile images now live under `profiles/<userId>/…`; legacy images stay
  at `profiles/<timestamp>-<name>.jpg` until the user next replaces their
  avatar (POST's cleanup deletes the old blob then). The DELETE exact-match
  fallback can be removed once no `user.profileImageUrl` values point at flat
  paths — a cheap follow-up query someday, not worth scheduling now.
- If listing-image or other upload routes get a DELETE someday, copy this
  ownership pattern — prefix-scope by owner id at upload time.
- Upload rate limiting (per-user quotas) remains open by choice — there's a
  TODO in `src/app/api/listings/[listingId]/route.ts` about
  `@upstash/ratelimit`; it needs an infra decision first.
- Reviewer focus: the DELETE 403 ordering (after the 400 prefix check, before
  `deleteFromBlob`), and that the dev page still works locally.
