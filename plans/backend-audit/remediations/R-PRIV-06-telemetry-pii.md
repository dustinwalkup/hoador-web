# Plan R-PRIV-06: Stop logging verification URLs/emails, and strip cookies/headers/PII from Sentry

> **Executor instructions**: Follow step by step, run every verification
> command, and confirm the result before moving on. On a STOP condition,
> stop and report. Parts A and B touch disjoint files and can be done in
> either order.
>
> **Drift check (run first)**:
> `git diff --stat 25e2233..HEAD -- src/services/resend/send-verification-email.ts src/services/better-auth/build-auth-options.ts src/lib/logger/redact.ts sentry.server.config.ts sentry.edge.config.ts src/instrumentation-client.ts src/instrumentation.ts src/lib/sentry/user-context.ts src/components/sentry-user-sync.tsx`
> Any change means re-reading the live file before editing it; a mismatch in
> the logic described below (not formatting) is a STOP for that part only.

## Status

- **Priority**: P1 · **Effort**: S · **Risk**: LOW · **Depends on**: none
- **Category**: privacy · **Planned at**: commit `25e2233`, 2026-09-24
- **Fixes**: PRIV-06, PRIV-07

## Why this matters

- **PRIV-06**: A verification/reset URL is a bearer token — opening it signs
  you in. Today it's printed to stdout in plain `console.log`, alongside raw
  email addresses, bypassing the structured logger's redaction entirely.
  Anyone with log access (a hosting dashboard, a log shipper, a support
  tool) can take over any unverified account.
- **PRIV-07**: `sendDefaultPii: true` plus Sentry's default
  `RequestData` integration attaches the `better-auth.session_token` cookie
  and every request header — including the mobile app's `Cookie` header —
  to every captured error, regardless of `sendDefaultPii`. `setUser()` also
  sends email/username. Anyone with Sentry access can reuse a live session.

## Current state

**PRIV-06** — `src/services/resend/send-verification-email.ts:20-22`:
`console.log("Sending verification email to:", to)`,
`console.log("Verification URL:", verificationUrl)`,
`console.log("First name:", firstName)`. `build-auth-options.ts:137`:
``console.log(`Password for user ${user.email} has been reset.`)`` inside
`onPasswordReset`. `build-auth-options.ts:191`:
`console.log("Verification email sent to:", user.email)` inside
`sendVerificationEmail`. `src/services/resend/send-reset-password-email.ts`
has no email/URL logging (only `console.log("...", data?.id)`, a Resend
message id — fine as-is). `src/lib/logger/redact.ts:5-29` `SENSITIVE_KEYS`
has no `email` entry.

Checked and **already correct, no change needed**: `@better-auth/core`'s
`createLogger` (`node_modules/@better-auth/core/dist/env/logger.mjs:47`)
defaults `logLevel` to `"warn"` when no `logger` option is passed, and
`build-auth-options.ts` passes none today — so better-auth's own
`ctx.context.logger.info(\`Sign-up attempt for existing email: ${email}\`)`
(`node_modules/better-auth/dist/api/routes/sign-up.mjs:166`) is already
suppressed (`info`<`warn`). The finding's "set the better-auth logger to
warn" is already true by default; Step A2 pins it explicitly anyway so a
future upstream default change can't silently re-enable it.

**PRIV-07** — four Sentry init points, not the three the finding names (this
plan also covers the client one per the roadmap note's "server, edge,
client"):

- `sentry.server.config.ts:31` and `sentry.edge.config.ts:32`:
  `sendDefaultPii: true`. Their `beforeSend` (`:39-75` / `:38-70`) filters by
  HTTP status/message only — identical logic in both files, duplicated.
- `src/instrumentation-client.ts:31`: `sendDefaultPii: true` too (no
  `sentry.client.config.ts` exists in this Next.js version — this file _is_
  the client config, loaded by `src/instrumentation.ts`'s sibling
  `register()` mechanism for server/edge). Its `beforeSend` (`:37-55`)
  filters by status only, no message filter.
- `@sentry/core`'s `requestDataIntegration` default
  (`node_modules/@sentry/core/build/cjs/integrations/requestdata.js:8-13`):
  `DEFAULT_INCLUDE = { cookies: true, headers: true, ... }` — **`cookies`
  and `headers` are `true` regardless of `sendDefaultPii`**; only `ip` is
  gated by that flag. So flipping `sendDefaultPii` alone does **not** stop
  cookies/headers from attaching — the integration must be explicitly
  overridden (confirmed exported by both `@sentry/node` and
  `@sentry/vercel-edge`, which `@sentry/nextjs` re-exports).
- `src/lib/sentry/user-context.ts:14-18` `setSentryUser`:
  `Sentry.setUser({ id, email: user.email, username: user.name })` — called
  from `src/lib/api/route-helpers.ts:61` on every API error path.
- `src/components/sentry-user-sync.tsx:19-23`: the client-side twin,
  `Sentry.setUser({ id, email, username })`, mounted near the app root and
  synced from the session on every render change.

**Mobile**: `hoador-mobile/src/lib/sentry.ts` already initializes
`@sentry/react-native` with no `sendDefaultPii` (defaults off) and its own
`beforeSend`/`scrubEvent` (`src/lib/sentry-scrub.ts`), and never calls
`Sentry.setUser`. Out of scope — noted only for completeness.

## Commands you will need

| Purpose        | Command                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| Typecheck      | `bun run type-check`                                                                          |
| Lint           | `bun run lint`                                                                                |
| Targeted tests | `bun run test:run src/services/resend src/services/better-auth src/lib/logger src/lib/sentry` |
| Full tests     | `bun run test:run`                                                                            |

## Scope

**In scope**: `send-verification-email.ts` (remove 3 `console.log`s);
`build-auth-options.ts` (2 log lines + explicit `logger: {level: "warn"}`);
`src/lib/logger/redact.ts` (add `email` to `SENSITIVE_KEYS`); a new shared
`src/lib/sentry/scrub-event.ts`; `sentry.server.config.ts`,
`sentry.edge.config.ts`, `src/instrumentation-client.ts` (use the shared
scrubber, `sendDefaultPii: false`, override `requestDataIntegration` on
server/edge); `src/lib/sentry/user-context.ts` and
`src/components/sentry-user-sync.tsx` (`setUser` → `{id}` only); tests for
the scrubber.

**Out of scope**: `hoador-mobile`'s Sentry setup (already clean, see above);
`console.error(..., error)` calls in the resend services and
`build-auth-options.ts` (the caught error object, not a URL/email literal —
flag separately if a Resend error message ever echoes the address back);
SEC-16's error-message-leaks-into-Sentry problem (owned by roadmap 1.7).

## Git workflow

Work directly on `develop`. Do not commit or push.

## Steps

### Part A — PRIV-06: stop logging URLs/emails

**A1.** In `send-verification-email.ts`, delete lines 20-22 (the three
`console.log`s). Leave the `console.log("Verification email sent
successfully:", data?.id)` at line 98 and the `console.error` calls alone
(no PII in either).

**A2.** In `build-auth-options.ts`:

- Line 137: ``console.log(`Password for user ${user.email} has been reset.`)``
  → ``console.log(`Password reset for user ${user.id}.`)``.
- Line 191: `console.log("Verification email sent to:", user.email)` →
  `console.log("Verification email sent to user:", user.id)`.
- Add an explicit, pinned logger level to the options object returned by
  `buildAuthOptions` (any top-level key, e.g. right after `baseURL`):
  ```ts
  logger: { level: "warn" },
  ```

**A3.** In `src/lib/logger/redact.ts`, add `"email"` to the `SENSITIVE_KEYS`
array (any position) — cheap defense-in-depth so a future
`logger.info({email, ...}, "...")` call is redacted automatically.

**Verify**: `grep -n "verificationUrl\|user.email" src/services/resend/send-verification-email.ts src/services/better-auth/build-auth-options.ts` shows no remaining `console.log` hit (only the removed lines' absence); `bun run type-check`.

### Part B — PRIV-07: Sentry PII

**B1. Shared scrubber.** Create `src/lib/sentry/scrub-event.ts`, moving the
existing (duplicated) filter logic from all three configs into one place and
adding the new stripping:

```ts
import type * as Sentry from "@sentry/nextjs";

/**
 * Shared beforeSend for the server, edge and client Sentry configs
 * (PRIV-07). Filters expected 4xx/validation errors, then strips PII the
 * SDK's own defaults would otherwise attach: request cookies/headers and
 * anything on event.user beyond `id`.
 */
export function scrubSentryEvent(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint,
): Sentry.ErrorEvent | null {
  if (process.env.NODE_ENV !== "production") return null;

  const error = hint.originalException;
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: number }).status;
    if (status === 404 || status === 400 || status === 401) return null;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("not found") ||
      message.includes("validation") ||
      message.includes("unauthorized") ||
      message.includes("authentication required")
    ) {
      return null;
    }
  }

  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
  }
  if (event.user) {
    event.user =
      event.user.id !== undefined ? { id: event.user.id } : undefined;
  }

  return event;
}
```

**B2.** In `sentry.server.config.ts` and `sentry.edge.config.ts`: replace
`sendDefaultPii: true` with `sendDefaultPii: false`; replace the whole
inline `beforeSend(event, hint) { ... }` body with
`beforeSend: scrubSentryEvent` (import it); add:

```ts
integrations: [
  Sentry.requestDataIntegration({ include: { ip: false, cookies: false, headers: false } }),
],
```

(User-supplied integrations of the same name override the SDK's default of
that name — this does not disable other default integrations.)

**B3.** In `src/instrumentation-client.ts`: `sendDefaultPii: true` → `false`;
replace the inline `beforeSend` with `beforeSend: scrubSentryEvent`
(same import). No `requestDataIntegration` override needed here — the
browser SDK has no server request/cookie context to attach in the first
place; `event.user` stripping (via the shared scrubber) is what matters
client-side, because of B4 below.

**B4.** `src/lib/sentry/user-context.ts` `setSentryUser`: change the
non-null branch to `Sentry.setUser({ id: user.id })` — drop `email` and
`username`. `src/components/sentry-user-sync.tsx`: change
`Sentry.setUser({...})` to `Sentry.setUser({ id: session.user.id })` the
same way.

**Verify**: `bun run type-check`.

**B5. Tests.** New `src/lib/sentry/__tests__/scrub-event.test.ts` (model:
`src/lib/sentry/__tests__/to-error.test.ts` for layout), with
`vi.stubEnv("NODE_ENV", "production")` in `beforeEach` and
`vi.unstubAllEnvs()` in `afterEach`: a 404/400/401-status error and each of
the four filtered message phrases → `null`; an event with
`request: {cookies: {...}, headers: {...}, url: "..."}` → returned event has
no `cookies`/`headers`, `url` untouched; an event with
`user: {id: "u1", email: "a@b.com", username: "A"}` → returned `user` is
exactly `{id: "u1"}`; `NODE_ENV` stubbed back to `"test"` → returns `null`
regardless of the above.

**Verify**: `bun run test:run src/lib/sentry/__tests__/scrub-event.test.ts`.

## Test plan

`bun run test:run` at the end. New coverage: the scrub-event unit test
(4-5 cases above). No existing test imports `send-verification-email.ts`'s
or `build-auth-options.ts`'s removed console lines directly (confirmed:
`grep -rn "console.log" src/services/resend/__tests__ src/services/better-auth/__tests__` —
no hits), so nothing else needs updating for Part A.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `grep -rn "console.log" src/services/resend/send-verification-email.ts` shows only the `data?.id` line
- [ ] `grep -n "user.email" src/services/better-auth/build-auth-options.ts` shows no hits inside `onPasswordReset`/`sendVerificationEmail`
- [ ] Both `sentry.server.config.ts` and `sentry.edge.config.ts` have `sendDefaultPii: false` and a `requestDataIntegration` override
- [ ] `src/instrumentation-client.ts` has `sendDefaultPii: false`
- [ ] `setSentryUser` and `SentryUserSync` set only `id`
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`

## STOP conditions

- Any file in "Current state" drifted in its filtering/PII logic (not formatting) — re-read, don't guess.
- `Sentry.requestDataIntegration` is not exported by the installed `@sentry/nextjs` version (checked live against `^10` and confirmed present in both `@sentry/node` and `@sentry/vercel-edge` type defs) — if a version bump removed it, report rather than guessing an alternative API.
- Any test fails twice after a reasonable fix attempt.

## Mobile compatibility

No API response shape, status, or error `code` changes — this plan touches
only logging and Sentry configuration. `hoador-mobile`'s own Sentry setup
(`src/lib/sentry.ts`) is untouched and already scrubs PII independently; no
row needed in the roadmap's Mobile client follow-ups table.

## Maintenance notes

- The `console.error(..., error)` calls left in place (resend services,
  `build-auth-options.ts`) log the caught exception object, not a literal
  URL/email — but a third-party error message could theoretically echo the
  address back (e.g. "Invalid recipient: a@b.com"). Not touched here to keep
  this S-sized; worth a follow-up scrub if a real occurrence is ever seen in
  logs.
- If a future change needs request headers in Sentry for debugging, prefer
  widening `requestDataIntegration`'s `include` to specific safe header
  names (e.g. `user-agent`) rather than re-enabling `headers: true`
  wholesale — `cookie`/`authorization` must never be included.
