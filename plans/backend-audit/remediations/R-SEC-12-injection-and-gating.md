# Plan R-SEC-12: Escape email interpolations, stop reconstructing markup at write time, gate the e2e auth stub, and lock down admin PATCH

> **Executor instructions**: Follow step by step, run every verification
> command, and confirm the result before moving on. On a STOP condition,
> stop and report. Parts A/B/C touch disjoint files and can be done in any
> order.
>
> **Drift check (run first)**:
> `git diff --stat 25e2233..HEAD -- src/lib/utils/sanitize.ts src/features/messages/notifications/message-received.ts src/features/rentals/notifications/rental-request-created.ts src/features/rentals/notifications/rental-denied.ts "src/app/api/rentals/[id]/decline/route.ts" src/features/disputes/notifications/dispute-notifications.ts src/app/api/disputes/route.ts src/features/notifications/lib/ops-alerts.ts src/services/better-auth/e2e-google-plugin.ts src/services/better-auth/build-auth-options.ts "src/app/api/admin/users/[userId]/route.ts" src/app/api/admin/users/bulk-actions/route.ts src/features/auth/utils/guards.ts src/dal/user.dal.ts`
> Any change to these means re-reading the live file before editing it — a
> logic mismatch (not formatting) is a STOP for that part only.

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none
- **Category**: security · **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: SEC-12, SEC-17, SEC-06

## Why this matters

- **SEC-12**: PATCH your name to an entity-encoded fake link
  (`&lt;a href=phish&gt;Verify payout&lt;/a&gt;`), message anyone or file a
  dispute. `sanitizeText`'s `decodeHtmlEntities` turns that back into a live
  `<a>` at write time, and several email templates interpolate
  names/reasons/descriptions into HTML unescaped — the victim gets a real,
  DKIM-signed phishing link from `noreply@hoador.com`.
- **SEC-17**: `GET /api/auth/e2e-callback` mints a session for any email,
  gated only by `E2E_TEST=1` — no `NODE_ENV` check. If that var were ever set
  in a real deployment, it's a sign-in-as-anyone primitive.
- **SEC-06**: `PATCH /api/admin/users/[userId]` blocks _promotion_ to
  admin/superadmin unless the caller is superadmin, but any admin can freely
  _demote or suspend_ an admin/superadmin — the gate isn't symmetric.

## Current state

**SEC-12** — `src/lib/utils/sanitize.ts:13-24` `decodeHtmlEntities` decodes
`&amp; &lt; &gt; &quot; &#x27; &#x2F; &#39; &nbsp;`; `sanitizeText` (`:52-59`)
does `decodeHtmlEntities(sanitizeHtml(text))`, and `sanitizeHtml` (`:32-45`)
strips real tags via `sanitize-html`'s `allowedTags: []`. Because the parser
decodes entities on read and re-encodes leftover `< > &` on serialize, a
_real_ `<script>`/`<a>` tag is already stripped, but an _entity-encoded_
fake tag round-trips through `sanitizeHtml` unchanged (still text) and only
becomes live markup once `decodeHtmlEntities` runs. Callers via
`sanitizeTextWithMaxLength`/`sanitizeMessageContent` (both call
`sanitizeText`): `src/dal/user.dal.ts:231-243` (`firstName`/`lastName`/`bio`),
`src/dal/listing.dal.ts:282-297,520-541` (name/description/brand/model/
instructions/safetyNotes), `src/dal/rentals.dal.ts:2273-2276`
(pickup/return instructions), `src/dal/messages.dal.ts:399,435,852` (message
content). Two fields skip sanitization entirely:
`denialReason` (`"src/app/api/rentals/[id]/decline/route.ts:17-18"`, only
`min(1)`) and dispute `description` (`src/app/api/disputes/route.ts:101-103`,
only `min(10)`).

Unescaped `email.html` interpolations (verified live, no `escapeHtml`
anywhere in these files):

| File                                         | Interpolated                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message-received.ts:59`                     | `${senderName}`                                                                                                                                                                                             |
| `rental-request-created.ts:59-100` (7 spots) | `${ownerName}`, `${renterName}`, `${listingName}`                                                                                                                                                           |
| `rental-denied.ts:59,63,71`                  | `${renterName}`, `${ownerName}`, `${listingName}`, `${denialReason}`                                                                                                                                        |
| `dispute-notifications.ts` (6 send sites)    | `${createdByName}`, `${detail.listingTitle}`/`${rental.listingName}`, `${notifyUserName}`/`${rental.*Name}`, `${dispute.description}`, `${outcomeText}`, `${resolvedByName}`, `${dispute.resolutionReason}` |
| `ops-alerts.ts:64-67`                        | `${event}`, `${message}` (ops-authored today; cheap to close alongside the rest)                                                                                                                            |

The escaping helper already exists and is used correctly elsewhere:
`src/lib/utils/escape-html.ts` `escapeHtml()`, e.g.
`src/app/api/hoa-inquiries/route.ts:83-89`.

**Mobile**: `hoador-mobile/src/features/messages/components/message-bubble.tsx:23-28`
renders content in a plain `<Text>`, relying on the server storing plain
text (a literal `&`, not `&amp;`) — deliberately does not re-decode. This
plan keeps that true for every entity except `&lt;`/`&gt;` (see Decision).

**SEC-17** — `e2e-google-plugin.ts:28` checks only
`process.env.E2E_TEST !== "1"`. `build-auth-options.ts:243` registers
`e2eGoogleCallbackPlugin()` unconditionally. For contrast,
`"src/app/api/auth/[...all]/route.ts:15-19"` already checks both
`NODE_ENV !== "production"` and `E2E_TEST === "1"`. `playwright.config.ts:78-88`
starts the e2e app with `bun run dev`, and `next dev` always forces
`NODE_ENV=development`, so gating on `NODE_ENV !== "production"` won't break
e2e.

**SEC-06** — `"src/app/api/admin/users/[userId]/route.ts:79-155"`
`patchHandler`: body is cast, not zod-validated (line 90); the superadmin
check (`isSuperAdmin()`, `src/features/auth/utils/guards.ts:37-41`) only
fires for `userType === "admin"|"superadmin"` (lines 105-116) — demotion
(`userType: "standard"`) and any `status` change run ungated.
`src/app/api/admin/users/bulk-actions/route.ts:71-110`'s `update_status` has
the same gap. `userTypeEnum` (`src/db/schemas/_enums.ts:118-122`):
`standard|admin|superadmin`. `userStatusEnum` (`:3-10`):
`pending_verification|email_verified|incomplete_profile|active|inactive|suspended`.
`userDAL.adminUpdateUser` (`src/dal/user.dal.ts:601-625`) applies whatever
it's given — the gate belongs in the route, per `CLAUDE.md`'s DAL-is-auth-
agnostic rule. `"src/app/api/admin/users/[userId]/__tests__/route.test.ts"`
covers only `DELETE` today.

## Decisions for the maintainer

**SEC-12 — how far to roll back `decodeHtmlEntities`.** `sanitize-html`
cannot tell a literal `<`/`>` from an attacker's `&lt;`/`&gt;` — both parse
to the same text-node value and both re-encode identically. Decoding either
is what lets a stored value reconstruct a tag.

- **Option A (recommended, implemented below):** stop decoding only
  `&lt;`/`&gt;`; keep decoding `&amp; &quot; &#x27; &#x2F; &#39; &nbsp;`.
  Ordinary text is unaffected on web and mobile — no contract change. Only
  literal `<`/`>` in a name/message will render as `&lt;`/`&gt;` going
  forward (rare, and consistent across both platforms).
- **Option B (roadmap's literal wording — drop `decodeHtmlEntities`
  entirely):** every sanitized field stores `sanitizeHtml`'s raw output, so
  a typed `&` becomes `&amp;` in storage — exactly the regression
  `message-bubble.tsx:23-28` warns against, on a mobile binary that can't be
  hot-fixed. Don't take this without a coordinated mobile release.

**Backfill**: rows written before this fix that already hold a live `<`/`>`
from a past encoded-tag submission are not cleaned here (no way to tell
"legit literal `<`" from "past exploit" at the DB level) — see the ops query
in Maintenance notes.

## Commands you will need

| Purpose        | Command                                                                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck      | `bun run type-check`                                                                                                                                                                                                                                                                  |
| Lint           | `bun run lint`                                                                                                                                                                                                                                                                        |
| Targeted tests | `bun run test:run src/lib/utils/__tests__/sanitize.test.ts src/features/messages/notifications src/features/rentals/notifications src/features/disputes/notifications src/features/notifications/lib/__tests__/ops-alerts.test.ts src/services/better-auth "src/app/api/admin/users"` |
| Full tests     | `bun run test:run`                                                                                                                                                                                                                                                                    |

## Scope

**In scope**: `src/lib/utils/sanitize.ts` + test; the 5 email-sink files
above + new/extended tests; the decline and disputes routes (sanitize + cap
the two free-text fields); `e2e-google-plugin.ts` + `build-auth-options.ts`
(NODE_ENV gate); admin `[userId]` PATCH handler (zod + superadmin gate) +
test file; `bulk-actions/route.ts` (same target-privilege guard,
`update_status` only).

**Out of scope**: `email-templates.ts` (re-engagement bulk email — not in
the cited sink list, flag separately); `dispute.resolutionReason`'s storage
path (admin-authored, only escaped at the sink); the e2e plugin's
session-creation logic; a "last superadmin" head-count guard (see
Maintenance notes).

## Git workflow

Work directly on `develop`. Do not commit or push.

## Steps

### Part A — SEC-12: injection

**A1. Stop reconstructing markup** (`sanitize.ts:13-24`):

```ts
function decodeHtmlEntities(text: string): string {
  // &lt;/&gt; deliberately NOT decoded (SEC-12): sanitize-html can't tell a
  // literal "<"/">" from an attacker's encoded fake tag, so decoding either
  // lets stored text reconstruct markup once interpolated unescaped into an
  // email. See R-SEC-12 Decisions.
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
```

In `sanitize.test.ts`, update `"should handle special characters"`:
`sanitizeText("Test < > &")` now returns `"Test &lt; &gt; &"`. Add:
`sanitizeText('&lt;a href="x"&gt;Click&lt;/a&gt;')` →
`"&lt;a href=&quot;x&quot;&gt;Click&lt;/a&gt;"` (no live `<a>`).

**Verify**: `bun run test:run src/lib/utils/__tests__/sanitize.test.ts`.

**A2. Escape every interpolation in the 5 sink files.** Import `escapeHtml`
from `@/lib/utils/escape-html` in each; wrap every variable from the table
above inside `email.html` only (not `text:` — plain text doesn't render
markup). Example (`rental-denied.ts:71`):

```ts
<p style="margin: 0; color: #64748b;">${escapeHtml(denialReason)}</p>
```

Apply the same wrap to every other name/description/reason spot in that
file and the other four. `${outcomeText}`/`formatReasonCode(...)` come from
a fixed lookup, not raw input, but wrap them too — cheap, removes them from
future audits. Leave `${linkUrl}`, `${baseUrl}`, `${EMAIL_LOGO_HTML}`
un-escaped (server-built, not user content).

**Verify**: `grep -rLn "escapeHtml" src/features/messages/notifications/message-received.ts src/features/rentals/notifications/rental-request-created.ts src/features/rentals/notifications/rental-denied.ts src/features/disputes/notifications/dispute-notifications.ts src/features/notifications/lib/ops-alerts.ts` prints nothing (all 5 now import it).

**A3. One regression test per sink file**, mocking `sendNotification` (model:
`src/features/disputes/notifications/__tests__/deadline-notifications.test.ts`,
which already mocks it). Pass a poisoned name/reason
(`&lt;a href="evil.example"&gt;Click&lt;/a&gt;`) and assert the captured
`email.html` does **not** contain `<a href`, e.g.
`expect(vi.mocked(sendNotification).mock.calls[0][0].email!.html).not.toContain("<a href")`.

**A4. Sanitize and cap the two ungated fields.** In the decline route,
import `sanitizeTextWithMaxLength` (matches the sibling `cancel`/`end`/
`start` routes); change `declineRequestSchema.denialReason` to
`z.string().min(1).max(1000)`; replace `validatedData.denialReason` with
`sanitizeTextWithMaxLength(validatedData.denialReason, 1000)` before calling
`rentalDAL.declineRentalRequest(...)` (and in the notification `data` a few
lines below). In `src/app/api/disputes/route.ts`, add `.max(2000)` to
`description` and sanitize it the same way before
`DisputeCreationService.createDispute`.

**Verify**: `bun run type-check`; `bun run test:run "src/app/api/rentals/[id]/decline" src/app/api/disputes`.

### Part B — SEC-17: gate the e2e plugin

`e2e-google-plugin.ts:28`:

```ts
if (process.env.NODE_ENV === "production" || process.env.E2E_TEST !== "1") {
  return ctx.json({ error: "Not in E2E mode" }, { status: 404 });
}
```

`build-auth-options.ts:243` — don't register the plugin outside non-production:

```ts
plugins: [
  ...(process.env.NODE_ENV !== "production" ? [e2eGoogleCallbackPlugin()] : []),
  expo(),
  nextCookies(),
],
```

**Verify**: `bun run type-check`. The sibling plan
`R-TEST-09-money-route-test-gaps.md` Part F adds
`src/services/better-auth/__tests__/e2e-google-plugin-gating.test.ts` as
`it.fails` (`vi.stubEnv("NODE_ENV","production")` +
`vi.stubEnv("E2E_TEST","1")`, hit `/e2e-callback` via a real
`betterAuth(buildAuthOptions(...))` instance, expect 404) — create that file
now if the sibling plan hasn't landed, using its exact spec, or flip its
existing `it.fails` to plain `it` (add `afterEach(() => vi.unstubAllEnvs())`
if missing).

**Verify**: `bun run test:run src/services/better-auth` → passes as plain `it`.

### Part C — SEC-06: admin PATCH validation and superadmin gate

**C1. Zod-validate the body.** Above `patchHandler`:

```ts
const adminUserPatchSchema = z
  .object({
    status: z
      .enum([
        "pending_verification",
        "email_verified",
        "incomplete_profile",
        "active",
        "inactive",
        "suspended",
      ])
      .optional(),
    userType: z.enum(["standard", "admin", "superadmin"]).optional(),
  })
  .refine((d) => d.status !== undefined || d.userType !== undefined, {
    message: "At least one of status or userType is required",
  });
```

Replace the manual cast + length check with
`const parsed = adminUserPatchSchema.safeParse(await request.json().catch(() => null));`
→ 400 on `!parsed.success`. Use `parsed.data.status`/`.userType` below.

**C2. Symmetric superadmin gate**, run before any update, on the target's
**current** privilege — keep the existing promotion check (a `standard`
target being promoted isn't caught by this one) and add:

```ts
const { status, userType } = parsed.data;
const existing = await userDAL.getUserById(userId);

if (existing.userType === "admin" || existing.userType === "superadmin") {
  const superAdmin = await isSuperAdmin();
  if (!superAdmin) {
    return NextResponse.json(
      { error: "Only superadmin can modify an admin or superadmin account" },
      { status: 403 },
    );
  }
}
// ...existing promotion check (userType === "admin"|"superadmin") stays, unchanged
```

A second `isSuperAdmin()` call when both fire is fine. Reuse this `existing`
fetch for the audit-log diff further down; don't fetch it twice.

**C3. Same guard in bulk actions.** In the `update_status` loop, after
fetching `existingResult`, skip protected targets for a non-superadmin
caller:

```ts
const isSuperAdminCaller = await isSuperAdmin(); // hoist above the loop
// inside the loop, after existingResult:
if (
  !isSuperAdminCaller &&
  ["admin", "superadmin"].includes(existingResult.data?.userType ?? "")
) {
  results.push({
    userId,
    success: false,
    error: "Only superadmin can modify an admin or superadmin account",
  });
  continue;
}
```

Import `isSuperAdmin` from `@/features/auth/utils/guards`.

**Verify**: `bun run type-check && bun run lint`.

**C4. Tests.** Add to `"[userId]/__tests__/route.test.ts"`: invalid body →
400; admin demoting/suspending a superadmin → 403, `adminUpdateUser` never
called; superadmin doing either → 200. New file
`bulk-actions/__tests__/route.test.ts`: admin caller, `update_status` on one
`standard` + one `superadmin` id → `standard` succeeds, `superadmin` comes
back `success: false`, `adminUpdateUser` called only for `standard`.

**Verify**: `bun run test:run "src/app/api/admin/users"`.

## Test plan

`bun run test:run` at the end, covering: `sanitize.test.ts` (2 new cases), 5
email-sink poisoned-input tests, the e2e gating test, 4 admin-PATCH cases,
and the new bulk-actions test file.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `decodeHtmlEntities`'s replace chain no longer contains `&lt;`/`&gt;`
- [ ] Every email sink escapes name/reason/description fields
- [ ] `NODE_ENV=production` + `E2E_TEST=1` → e2e callback 404s (test)
- [ ] A non-superadmin PATCH/bulk-action demoting or suspending an admin/superadmin returns 403/failure and writes nothing
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`

## STOP conditions

- Any file in "Current state" drifted in its authz/escaping logic (not formatting) — re-read, don't guess.
- A poisoned-input test still shows `<a href` after A1+A2 — check both layers landed (a `sanitize.ts`-only or escaping-only fix leaves the other exposed).
- Any test fails twice after a reasonable fix attempt.

## Mobile compatibility

No response shape, status, or error `code` changes. The one visible change
— literal `<`/`>` no longer round-trips back from `&lt;`/`&gt;` — is a
plain-string content change, not a contract change; the field stays a
string on both platforms, and `message-bubble.tsx:23-28`'s "server already
decoded" assumption holds for every entity except `&lt;`/`&gt;`. No row
needed in the roadmap's Mobile client follow-ups table.

## Maintenance notes

- **Ops query (read-only, hand to the maintainer)** for rows that may
  already hold a live `<`/`>` from a past encoded-tag submission (not
  auto-cleanable — indistinguishable from a legitimate character):
  `select id from "user" where first_name ~ '[<>]' or last_name ~ '[<>]' or bio ~ '[<>]'`
  and the analogous `~ '[<>]'` check against `listing.name/description/instructions`,
  `rental_requests.denial_reason`, and `disputes.description`.
- Not implemented here: a "cannot demote/suspend the last superadmin"
  head-count guard (needs a new `userDAL.countSuperadmins()`). Today's fix
  already blocks the sabotage scenario in the finding (only superadmin can
  touch an admin/superadmin account at all) — this is a smaller, separate
  self-lockout concern.
- `src/features/notifications/utils/email-templates.ts` (re-engagement bulk
  email) interpolates `recipientName` unescaped too, outside the cited
  finding's file list — worth a follow-up if picked up.
