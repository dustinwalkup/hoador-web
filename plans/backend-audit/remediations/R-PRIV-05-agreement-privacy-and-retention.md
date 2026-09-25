# Plan R-PRIV-05: Private agreement PDFs with signed URLs; hide card-decline reasons from the owner; Stripe/card retention window after deletion

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 29fe557..HEAD -- src/services/vercel-blob/index.ts src/services/playwright/generate-rental-agreements/utils.ts src/services/playwright/generate-service-agreements/utils.ts src/app/api/internal/generate-rental-agreement/route.ts src/app/api/rentals/[id]/route.ts src/app/api/services/bookings/[id]/route.ts src/dal/rentals.dal.ts src/features/rentals/lib/rental-detail-response.ts src/features/rentals/notifications/payment-failure.ts src/features/rentals/services/rental-service.ts src/dal/account-deletion.dal.ts src/features/users/services/account-deletion-service.ts src/db/schemas/user.schema.ts src/features/rentals/components/detail-page/rental-details-server.tsx src/app/dashboard/services/bookings/[id]/page.tsx src/dal/legal-document.dal.ts .github/workflows/cron-jobs.yml`
> On any change, compare "Current state" against live code first; a mismatch
> is a STOP condition.

## Status

- **Priority**: P2 · **Effort**: M · **Risk**: MED (changes what a
  cross-repo-consumed field, `agreement.pdfUrl`, looks like on the wire; needs
  a **new private Blob store per environment** and its token; a new daily
  cron that calls `stripe.customers.del`)
- **Depends on**: R-PRIV-09 (`DONE`, uncommitted) for `pathnameFromBlobUrl`/
  `listBlobsByPrefix` — already landed in `src/services/vercel-blob/index.ts`,
  reused here, not re-added. Builds on its deferred retention-window note.
- **Category**: privacy / data retention · **Planned at**: commit `29fe557`,
  2026-09-25
- **Fixes**: PRIV-05, PRIV-08, and the Stripe-customer/card-metadata
  retention window PRIV-09 deferred to Phase 2

## Why this matters

**PRIV-05.** Rental and service agreement PDFs — full legal names, the
renter's delivery address or the owner's pickup address, and the total
charged — are uploaded `access: "public"` to a deterministic path
(`rental-agreements/<requestId>.pdf`). The only thing standing between a
non-party and the PDF is that they don't know the request id, and that id
travels in email links, push payloads, and — until this plan — a server log
line. It also never expires and is never deleted, so it outlives the rental,
outlives a party blocking the other, and outlives account deletion.

**PRIV-08.** A renter's card-decline reason (Stripe's own wording — e.g.
"Insufficient funds on the payment method") is shown to the **owner**, on the
owner-only `lending` list routes and in an email, telling a neighbor
something about the renter's finances that they have no reason to know.

**Retention window (PRIV-09 follow-on).** Self-deletion already anonymizes
the user row and scrubs blobs/PII fields (`R-PRIV-09`), but deliberately keeps
`stripeCustomerId` and local card metadata (`user_payment_methods`)
indefinitely — the roadmap moved this specific piece to Phase 2 rather than
leaving it unaddressed. A deleted user's card brand/last4/expiry stay live in
`user_payment_methods` forever, and the Stripe Customer object (with its
attached PaymentMethods) is never deleted either.

## Current state

**PRIV-05:**

- `src/services/vercel-blob/index.ts` `uploadToBlob` (already extended by
  R-PRIV-09 with `listBlobsByPrefix`/`pathnameFromBlobUrl`/`isOwnBlobUrl`) —
  `put(filename, file, { access: "public" })`, no way to request `private`.
  Used by avatar, listing photo, damage photo, and dispute evidence uploads
  too — **all of those stay public**, only agreement PDFs move (see Scope).
- ⚠️ **Access is per store, not per blob.** Vercel's Private Storage docs:
  "Private storage requires a private Blob store", and a store's access mode
  "cannot be changed after creation". The store behind today's
  `BLOB_READ_WRITE_TOKEN` is public (`isOwnBlobUrl` accepts only
  `*.public.blob.vercel-storage.com` hosts), so `put(..., { access: "private" })`
  with the default token fails. Agreements need a **second, private store**
  in each environment, reached with its own token passed explicitly
  (`token:`) to `put`/`issueSignedToken`. Private blob URLs have the form
  `https://<storeId>.private.blob.vercel-storage.com/<pathname>`
  (`constructBlobUrl`, `@vercel/blob/dist/chunk-3D2SZ6M2.js:352`).
- `src/services/playwright/generate-rental-agreements/utils.ts:34-37` and
  `generate-service-agreements/utils.ts` (mirror implementation) both call
  `uploadToBlob(filename, buffer)` with no options — public by default.
- `src/app/api/internal/generate-rental-agreement/route.ts:76`:
  `console.log("[pdf-gen-route] success", { rentalRequestId, url });` — still
  logs the full blob URL.
- `src/app/api/rentals/[id]/route.ts:132-142`: `agreement = agreementRow ? {
pdfUrl: agreementRow.url, templateVersion: agreementRow.version } : null;` —
  `agreementRow.url` is the raw, permanent blob URL, returned as-is.
- `src/app/api/services/bookings/[id]/route.ts:190-203`
  `resolveBookingAgreement` — same shape, same raw URL passthrough.
- `src/dal/legal-document.dal.ts:526-570` `getRentalAgreementAcceptance`
  already does the party-only check (renter or owner) and the three-tier
  fallback (generated doc → template versions) **before** returning
  `{version, url}` — this plan does not touch that gate, only what happens to
  `url` after it comes back. **Only the first tier is a generated agreement.**
  Tiers 2 and 3 return a `legal_documents.url`: the generic
  `per_rental_agreement` template PDF in the **public** store. It must be
  passed through unchanged. Presigning it against the private store would
  build a URL on the private host for a pathname that isn't there, so the
  link would 404 instead of degrading.
- **Two web RSC pages hand the raw URL to client components** (a second
  wire boundary, missed by an earlier draft):
  `src/features/rentals/components/detail-page/rental-details-server.tsx:64-87`
  calls `getRentalAgreementAcceptance` itself (plus its own extra fallback
  to `getCurrentVersion`) and passes `rentalAgreementUrl` →
  `rental-content.tsx` → `rental-actions.tsx`; and
  `src/app/dashboard/services/bookings/[id]/page.tsx:122,156` passes
  `serviceAgreementDoc?.pdfUrl` as `serviceAgreementUrl` →
  `service-booking-detail-client.tsx`. After agreements go private, both
  links 403 unless changed (Step 3b). Both are serialized into the RSC
  payload, so whatever goes there is as exposed as the API response.
- No email, push payload or notification carries an agreement URL (grep
  `pdfUrl|agreementUrl` under `src/`: only the files above, the DALs and the
  generators).
- **Confirmed `@vercel/blob@2.4.0` (already installed) supports everything
  cross-plan decision 3 asks for**, without an HMAC route of our own:
  `access: 'private'` on `put`, plus `issueSignedToken` + `presignUrl`
  (`node_modules/@vercel/blob/dist/create-folder-DFjrvss1.d.ts`) — issue a
  short-lived delegation scoped to one pathname, then presign a `GET` URL
  against it. No bearer token or session cookie is needed to fetch the
  resulting URL, satisfying the mobile in-app-browser constraint exactly.
  Typings (`create-folder-DFjrvss1.d.ts:325-425`): `issueSignedToken({ pathname,
operations: ['get'], validUntil, token? })` → `{ delegationToken,
clientSigningToken, validUntil }` (a network call to the Blob control API;
  `validUntil` max 7 days, default 1 hour); `presignUrl(signedToken, {
operation: 'get', pathname, validUntil?, access })` → `{ presignedUrl }`
  (local HMAC, no network), where `access` must match the store's mode.
  `issueSignedToken` defaults to OIDC/`BLOB_READ_WRITE_TOKEN`, i.e. the
  **public** store, so it too must get the private store's `token`.
- Damage photos and dispute evidence are **also** public with harder-to-guess
  paths, per the finding text — **out of scope here** (see Scope); the
  roadmap's Phase 2 step 6 and its own recommended fix only name agreement
  PDFs, PRIV-08, and the retention window.

**PRIV-08:**

- `src/dal/rentals.dal.ts` `getLendingRequestsByStatus` (owner-scoped, ~L820
  is the renter-side sibling; the owner one starts ~L920) and
  `getLendingRentalsByStatus` (owner-scoped, ~L1656) both select
  `paymentFailureReason: rentalRequests.paymentFailureReason` (~L961, ~L1697)
  — these are **owner-only** list methods (`ownerId` parameter), so this
  field never belongs in their projection at all.
- `getRentalDetailsById` (~L2387) is the **shared** detail query (both
  parties, `GET /api/rentals/[id]`) and also selects `paymentFailureReason`
  (~L2538 final shaping) with no role gate.
- `src/features/rentals/lib/rental-detail-response.ts` `toRentalDetailResponse`
  — the existing PRIV-01 role-projection mapper for this exact route —
  spreads `...rest` (everything except email/phone) for every non-admin role,
  so `paymentFailureReason` reaches the owner here too.
- `src/features/rentals/notifications/payment-failure.ts`
  `sendPaymentFailureNotificationToOwner` (~L173-onward) — both the in-app
  notification `data.failureReason` and the email's "Reason for Failure"
  section — receives and renders `failureReason`.
  `sendPaymentFailureNotificationToRenter` is correctly renter-only and stays
  as-is.
- Call site: `rental-service.ts` ~L649-657 passes
  `failureReason: errorMessage` (the same message
  `getPaymentErrorMessage`/`rental-payments.ts:150-151` derived from Stripe's
  decline code) into `sendPaymentFailureNotificationToOwner`.

**Retention window:**

- `src/dal/account-deletion.dal.ts` (~L306-308, per R-PRIV-09's own excerpt):
  `stripeCustomerId`/`stripeConnectedAccountId` are deliberately left on the
  `user` row, commented "kept: pseudonymous."
  `user_payment_methods` rows are deactivated (`isActive: false`), not
  deleted — R-PRIV-09 explicitly scoped this out ("follows the Stripe-customer
  retention window (Phase 2)").
- `user.schema.ts:92` `anonymizedAt: timestamp("anonymized_at")` — already
  set at self-deletion time (R-PRIV-09), the natural anchor for a retention
  clock. No new column is needed.
- `userPaymentMethods` (`user.schema.ts:222-247`) has `onDelete: "cascade"`
  on its `userId` FK — no RESTRICT concern; hard-deleting these rows is safe
  once the window passes.
- Deleting a Stripe **Customer** does not touch that customer's historical
  Charges, PaymentIntents, Transfers, or Disputes — those live independently
  in Stripe and remain fully reachable for chargeback handling and
  reconciliation after the customer object is gone. Deleting a **Connect
  account** is a materially bigger, harder-to-reverse operation (payout
  history, tax reporting) and is **not** what PRIV-09's finding asked for
  ("Delete the Stripe customer" — singular, customer only). Scoped out here
  (see Decisions).

## Decisions for the maintainer

**1. Retention window length — recommend 120 days.** Card-network chargeback
windows run up to ~120 days from the transaction date; a deleted user's most
recent charge could be that recent. Deleting the Stripe Customer doesn't
remove the underlying Charge/Dispute objects (see Current state), so the
window isn't protecting chargeback _handling_ — it's a buffer for **ops
investigation**, where having the customer's stored PaymentMethod/email still
in Stripe's dashboard is occasionally useful while a dispute from that period
could still land. **Recommendation: 120 days after `anonymizedAt`.** Steps
below use a named constant so this is a one-line change if the maintainer
picks a different number.

**2. Scope: delete the Stripe Customer and local card rows; leave
`stripeConnectedAccountId` alone.** The finding's recommended fix says
"Delete the Stripe customer," not the Connect account. A former owner/provider's
Connect account carries payout and tax-reporting history Stripe itself
retains regardless of what hoador does, and disconnecting/deleting it has
account-level consequences (1099 reporting, potential negative balance
handling) well outside a privacy cleanup's blast radius. **Not touched.** If
a future policy needs Connect-account cleanup too, it's a separate, larger
plan.

**3. A daily cron, not part of `deleteOwnAccount`.** The retention window is
the whole point — this can't run at deletion time. A new cron
(`purge-deleted-user-stripe-data`) follows the existing crons' shape
(`verify-cron-secret`, `CronRunHistoryService`, an alert on failure) and runs
in the `daily` GitHub Actions job, matching `monitor-deposit-expiry`'s
cadence for a similar "sweep expired things" job. Deleting the Customer
doesn't block refunds or chargebacks: both hang off the Charge/PaymentIntent,
which Stripe keeps, and `anonymizeUser` already detached every card (BIZ-07).
A chargeback after deletion still auto-creates a hoador dispute
(`chargeback-service.ts`), though, and ops may want the customer while it's
open. So the cron **skips a user with an open dispute**
(`accountDeletionDAL.countOpenDisputes`, the same check that blocks
self-deletion) and retries them on a later run.

**4. A second, private Blob store for agreements (new env var).** Private
access is per store (Current state). Options: (a) a new private store per
environment with its token in `BLOB_PRIVATE_READ_WRITE_TOKEN`, passed as
`token:` to `put` and `issueSignedToken`; (b) keep the public store and
stream PDFs through our own HMAC route (cross-plan decision 3's fallback).
**Recommendation: (a).** No streaming route, no custom signing code, and the
CDN verifies the signature. Pass the token explicitly rather than relying on
OIDC's `BLOB_STORE_ID`: with two stores connected to one project, the
implicit store is ambiguous, and every existing public-store call must keep
using the default. If the private token is unset, uploads **fail loudly**
(generation already retries/alerts). Never fall back to public.

**5. How web pages link to a private agreement.** The web detail pages are
RSC. Options: (a) sign at render (10-min URL in the RSC payload) — a tab left
open past the TTL gives a Vercel 403 page on click; (b) link to a
session-authenticated same-origin redirect route
(`GET /api/rentals/[id]/agreement`, `GET /api/services/bookings/[id]/agreement`)
that re-runs the party check and `302`s to a freshly signed URL — never
stale, and no bearer URL in the HTML. **Recommendation: (b).** It's two small
routes. Mobile can't use them (its in-app browser sends no cookie), so the
detail API responses still carry a signed `pdfUrl` (Step 3). Step 3b assumes
(b).

## Commands

| Purpose        | Command                                                                                                                                                                                                                                                           | Expected |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Typecheck      | `bun run type-check`                                                                                                                                                                                                                                              | exit 0   |
| Lint           | `bun run lint`                                                                                                                                                                                                                                                    | exit 0   |
| Targeted tests | `bun run test:run src/services/vercel-blob src/app/api/rentals/[id] src/app/api/services/bookings/[id] src/dal/__tests__/rentals.dal.test.ts src/features/rentals src/app/api/cron/purge-deleted-user-stripe-data src/dal/__tests__/account-deletion.dal.test.ts` | all pass |
| Real-DB tests  | `docker compose up -d && bun run db:push:e2e && bun run test:integration`                                                                                                                                                                                         | exit 0   |

No migration — no schema change (see Decision 1's note on reusing
`anonymizedAt`).

## Scope

**In scope**: `src/services/vercel-blob/index.ts` (`uploadToBlob`'s `access`
option, new `isPrivateBlobUrl`/`issueSignedBlobUrl`/`clientAgreementUrl`);
`.env.example` (`BLOB_PRIVATE_READ_WRITE_TOKEN`); new
`src/app/api/rentals/[id]/agreement/route.ts` and
`src/app/api/services/bookings/[id]/agreement/route.ts` (Decision 5);
`src/features/rentals/components/detail-page/rental-details-server.tsx` and
`src/app/dashboard/services/bookings/[id]/page.tsx` (RSC agreement links);
`src/services/playwright/generate-rental-agreements/utils.ts`;
`src/services/playwright/generate-service-agreements/utils.ts`;
`src/app/api/internal/generate-rental-agreement/route.ts` (drop the URL log);
`src/app/api/rentals/[id]/route.ts`; `src/app/api/services/bookings/[id]/route.ts`;
`src/dal/rentals.dal.ts` (drop `paymentFailureReason` from the two owner-only
lending selects); `src/features/rentals/lib/rental-detail-response.ts`
(role-gate `paymentFailureReason`); `src/features/rentals/notifications/payment-failure.ts`
(`sendPaymentFailureNotificationToOwner`); `src/features/rentals/services/rental-service.ts`
(drop the `failureReason` argument at its one call site); new
`src/app/api/cron/purge-deleted-user-stripe-data/route.ts`;
`src/dal/account-deletion.dal.ts` (a new query for eligible users, a new
purge method); `.github/workflows/cron-jobs.yml` (`daily` job); tests for all
of the above.

**Out of scope**: damage photos and dispute evidence (still public — a known
gap the finding names but the roadmap doesn't schedule here; flagged in
Maintenance notes); `stripeConnectedAccountId` (Decision 2);
`disputeEvidence`/`auditLogs` retention (already scoped out by R-PRIV-09 for
the same legal/audit-trail reason agreement PDFs themselves are _retained_,
just made private, not deleted); any change to
`getRentalAgreementAcceptance`'s party-only gate (already correct).

## Git workflow

Work directly on `develop`. Do not commit.

## Steps

### 1 (PRIV-05): Private blobs, opt-in, on the private store

In `src/services/vercel-blob/index.ts`, widen `uploadToBlob` without
changing its default for every existing caller. `private` goes to the
private store (Decision 4) and never silently falls back to public:

```ts
import { put, del, list, issueSignedToken, presignUrl } from "@vercel/blob";

/** Token for the private store that holds agreement PDFs (PRIV-05). The
 * default `BLOB_READ_WRITE_TOKEN` store is public; access is per store. */
function privateBlobToken(): string {
  const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_PRIVATE_READ_WRITE_TOKEN is not set");
  }
  return token;
}

export async function uploadToBlob(
  filename: string,
  file: File | Buffer,
  options?: { access?: "public" | "private" },
): Promise<BlobUploadResult> {
  const access = options?.access ?? "public";
  const blob = await put(filename, file, {
    access,
    ...(access === "private" ? { token: privateBlobToken() } : {}),
  });
  return { url: blob.url, pathname: blob.pathname };
}

/** True for a URL on a private Vercel Blob store. Never throws. */
export function isPrivateBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".private.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
```

Add the signed-URL helper next to the existing blob helpers:

```ts
/**
 * A short-lived URL that works without a session cookie, for a blob on the
 * private store (PRIV-05). The mobile app opens `agreement.pdfUrl` in an
 * in-app browser that sends no cookie (cross-plan decision 3).
 * `issueSignedToken` is a network call to the Blob control API;
 * `presignUrl` is a local HMAC.
 */
export async function issueSignedBlobUrl(
  url: string,
  ttlMs: number,
): Promise<string> {
  const pathname = pathnameFromBlobUrl(url);
  const validUntil = Date.now() + ttlMs;
  const signedToken = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
    token: privateBlobToken(),
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });
  return presignedUrl;
}

export const AGREEMENT_SIGNED_URL_TTL_MS = 10 * 60 * 1000;

/**
 * What a client may be handed for an agreement URL: a fresh signed URL for a
 * private (generated) agreement; any other URL unchanged. The generic
 * `per_rental_agreement` template and agreements generated before this
 * plan live on the public store and must not be presigned against the
 * private one (they would 404).
 */
export async function clientAgreementUrl(url: string): Promise<string> {
  return isPrivateBlobUrl(url)
    ? issueSignedBlobUrl(url, AGREEMENT_SIGNED_URL_TTL_MS)
    : url;
}
```

Add `BLOB_PRIVATE_READ_WRITE_TOKEN=` (commented, with a one-line
explanation) to `.env.example`.

**Verify**: `bun run type-check` → exit 0. New unit tests in
`src/services/vercel-blob/__tests__/` (mock `@vercel/blob`):
`uploadToBlob(..., { access: "private" })` calls `put` with
`access: "private"` and the private token, and throws when the env var is
unset (no public fallback); the default call is unchanged (`access:
"public"`, no `token`); `issueSignedBlobUrl` passes the private token and
`operations: ["get"]` to `issueSignedToken`, and `access: "private"` plus the
pathname to `presignUrl`; `clientAgreementUrl` returns a
`*.public.blob.vercel-storage.com` URL unchanged without calling
`issueSignedToken`.

### 2 (PRIV-05): Upload agreements privately; stop logging the URL

In both `generate-rental-agreements/utils.ts` and
`generate-service-agreements/utils.ts`, change the upload call:

```ts
const { url } = await uploadToBlob(filename, buffer, { access: "private" });
```

In `generate-rental-agreement/route.ts:76`, drop the URL from the log:

```ts
console.log("[pdf-gen-route] success", { rentalRequestId });
```

(check `generate-service-agreement/route.ts` too — grep confirmed it
currently only logs errors, not a success line; leave it as-is if that's
still true, and apply the same redaction if a URL-logging line has been
added since the drift-check commit.)

**Verify**: `bun run type-check` → exit 0. `grep -n "console.log.*url" src/app/api/internal/generate-rental-agreement/route.ts`
finds no match (the route's `NextResponse.json({ url })` reply to the
internal caller stays; a private URL is useless without a signature); extend that route's existing test to assert `console.log` is
never called with a `url` key (mirror R-PRIV-06's console-spy pattern).

### 3 (PRIV-05): Detail routes return a signed URL, not the stored one

`AGREEMENT_SIGNED_URL_TTL_MS` (10 minutes, Step 1) is long enough for the
mobile in-app browser to load the PDF right after the detail screen renders,
and short enough that a leaked link in a shared screenshot or log stops
working quickly. See Mobile compatibility for the screen-left-open case.

In `rentals/[id]/route.ts`, keep the existing "a lookup failure degrades to
`null`" contract, extended to cover the signing step. Use `clientAgreementUrl`,
not `issueSignedBlobUrl` directly: tiers 2-3 return the public template URL,
which must pass through unchanged:

```ts
const { data: agreementRow } = await tryCatch(
  legalDocumentDAL.getRentalAgreementAcceptance(id, userId),
);
let agreement: { pdfUrl: string; templateVersion: string } | null = null;
if (agreementRow) {
  const { data: pdfUrl } = await tryCatch(clientAgreementUrl(agreementRow.url));
  agreement = pdfUrl ? { pdfUrl, templateVersion: agreementRow.version } : null;
}
```

In `services/bookings/[id]/route.ts`, `resolveBookingAgreement` gets the same
treatment:

```ts
const { data: generated } = await tryCatch(
  serviceAgreementDocumentDAL.getByServiceBookingId(bookingId),
);
if (!generated) return null;
const { data: pdfUrl } = await tryCatch(clientAgreementUrl(generated.pdfUrl));
if (!pdfUrl) return null;
return { pdfUrl, templateVersion: generated.templateVersion };
```

**Verify**: `bun run type-check` → exit 0. Extend both routes' tests (mock
`@/services/vercel-blob`): a private stored URL comes back as the mocked
signed value, not the stored URL; a public template URL (tier 2/3) comes back
unchanged; signing throwing degrades `agreement` to `null` rather than
failing the whole response (mirrors the existing "lookup failure degrades to
null" test).

### 3b (PRIV-05): Web pages link through a session-checked redirect (Decision 5)

New `src/app/api/rentals/[id]/agreement/route.ts` and
`src/app/api/services/bookings/[id]/agreement/route.ts`, `GET` only, auth via
`getAuthenticatedUserResponse()`:

- Rental: `legalDocumentDAL.getRentalAgreementAcceptance(id, userId)` (its own
  party check; `null` → 404). Booking: load the booking, 404 unless the user
  is requester or provider, then `serviceAgreementDocumentDAL.getByServiceBookingId`.
- `return NextResponse.redirect(await clientAgreementUrl(url), 302)` with
  `Cache-Control: private, no-store` (the Location header is a bearer URL).
- Wrap with `withRequestLogging`; errors via `handleApiError`. Don't log the
  URL.

Then the two RSC pages stop handing out the stored URL:

- `rental-details-server.tsx:64-87`: when the resolved URL
  `isPrivateBlobUrl`, pass `rentalAgreementUrl = \`/api/rentals/${rentalId}/agreement\``;
otherwise (template tiers, pre-plan public agreements, the page's own
`getCurrentVersion`fallback) pass it unchanged. The consumers open it
with`window.open(url, "\_blank", "noopener,noreferrer")`
(`rental-actions.tsx:110-112`, `service-booking-detail-client.tsx:785-795`),
  a top-level same-origin GET that carries the session cookie, so neither
  client component changes.
- `services/bookings/[id]/page.tsx:156`: same rule for
  `serviceAgreementDoc?.pdfUrl` →
  `/api/services/bookings/${id}/agreement`.

**Verify**: `bun run type-check` → exit 0. Route tests for both new routes:
non-party → 404; unauthenticated → 401; party with a private agreement →
302 to the mocked signed URL with `Cache-Control: private, no-store`; party
with a public template URL → 302 to that URL unchanged.
`grep -rn "pdfUrl\|\.url" src/features/rentals/components/detail-page/rental-details-server.tsx "src/app/dashboard/services/bookings/[id]/page.tsx"`
shows no stored agreement URL passed to a client component when it is
private.

### 4 (PRIV-08): Drop `paymentFailureReason` from the owner-only lending lists

In `rentals.dal.ts`, remove the line
`paymentFailureReason: rentalRequests.paymentFailureReason,` from both
`getLendingRequestsByStatus`'s select (~L961) and
`getLendingRentalsByStatus`'s select (~L1697). These are owner-scoped
methods; the field never belongs there.

**Verify**: `bun run type-check` → exit 0 (any TS consumer typed against
these methods' return shape that reads `.paymentFailureReason` now fails to
compile — grep `paymentFailureReason` under `src/features/rentals` and `src/app`
for any such reader before assuming none exists, and update it to stop
reading the field on these two response shapes). Known reader:
`lending-card.tsx:219,386` renders `request.paymentFailureReason || <generic
copy>`, so it falls back to the generic line with no change. The lending
types keep the field optional (`rentals.dal.ts:180,214`), so type-check won't
flag it. Keep `:860` (the renter-side `getRentingRequestsByStatus`): it's
the renter's own reason.

### 5 (PRIV-08): Role-gate it on the shared detail route

In `rental-detail-response.ts`, add the same per-field, per-role pattern the
file already uses for addresses:

```ts
export function toRentalDetailResponse(
  data: RentalDetails,
  viewerRole: RentalViewerRole,
): RentalDetailResponse {
  if (viewerRole === "admin") return data;
  const unlocked = ADDRESS_VISIBLE_STATUSES.has(data.status);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { renterEmail, renterPhone, ownerEmail, ownerPhone, ...rest } = data;
  return {
    ...rest,
    pickupAddress:
      viewerRole === "owner" || unlocked ? data.pickupAddress : undefined,
    deliveryAddress:
      viewerRole === "renter" || unlocked ? data.deliveryAddress : undefined,
    // PRIV-08: the decline reason is the renter's own financial detail — the
    // owner passively receiving it (here or by email/notification) tells them
    // something about a neighbor's finances they have no reason to know.
    paymentFailureReason:
      viewerRole === "renter" ? data.paymentFailureReason : undefined,
  };
}
```

The web detail RSC (`rental-details-server.tsx:47-50`) already goes through
`toRentalDetailResponse`, so this one change covers both wire boundaries:
`rental-status-progress.tsx:628`'s "Reason:" line stops rendering for the
owner.

**Verify**: `bun run type-check` → exit 0. Extend the route's existing test
(or `rental-detail-response.test.ts` if one exists, else add one): an owner
viewing a `payment_failed` request's detail sees `paymentFailureReason:
undefined`; the renter still sees it; an admin still sees it (unchanged early
return).

### 6 (PRIV-08): Stop sending the reason to the owner's notification/email

In `payment-failure.ts`, drop `failureReason` from
`sendPaymentFailureNotificationToOwner`'s parameter type and body entirely —
both the `data: { ..., failureReason }` field and the "Reason for Failure"
HTML/text block (`html`'s `<h3>Reason for Failure</h3>` section and the
`.text` block's `Reason for Failure:\n${failureReason}\n` line). The
existing generic copy ("we were unable to process their payment") stays;
`sendPaymentFailureNotificationToRenter` is unchanged.

In `rental-service.ts`, drop `failureReason: errorMessage,` from the
`sendPaymentFailureNotificationToOwner({...})` call (~L649-657). Removing the
parameter from the function's type signature means type-check forces this —
the only call site — to be updated; nothing else calls this function.

**Verify**: `bun run type-check` → exit 0. Extend
`payment-failure.ts`'s test (or the approve-deposit test that already mocks
both notification functions): the owner call never receives a
`failureReason` key; a snapshot/string-match of the owner email's rendered
HTML contains no "Reason for Failure" section and no occurrence of the
fixture's decline-reason string, while the renter email still does.

### 7 (retention window): DAL — find eligible users, purge their Stripe/card data

In `account-deletion.dal.ts`, add:

```ts
/** Days after self-deletion before the Stripe customer and local card
 * metadata are purged (see Decision 1). A named constant so the maintainer
 * can change the window without hunting through the query. */
export const STRIPE_RETENTION_DAYS = 120;

/**
 * Users anonymized more than STRIPE_RETENTION_DAYS ago who still have a
 * Stripe customer to purge. `stripeConnectedAccountId` is untouched
 * (Decision 2) — this only looks at `stripeCustomerId`.
 */
async findUsersDueForStripeRetentionPurge(
  limit: number,
): Promise<{ id: string; stripeCustomerId: string }[]> {
  try {
    // Cutoff computed in JS: no interval arithmetic on a bound parameter.
    const cutoff = new Date(Date.now() - STRIPE_RETENTION_DAYS * 86_400_000);
    const rows = await this.db
      .select({ id: user.id, stripeCustomerId: user.stripeCustomerId })
      .from(user)
      .where(
        and(
          isNotNull(user.stripeCustomerId),
          lt(user.anonymizedAt, cutoff), // NULL anonymizedAt never matches
        ),
      )
      .orderBy(asc(user.anonymizedAt))
      .limit(limit);
    return rows.filter(
      (r): r is { id: string; stripeCustomerId: string } =>
        r.stripeCustomerId !== null,
    );
  } catch (error) {
    this.handleError(error, "findUsersDueForStripeRetentionPurge");
  }
}

/** Null the local pointer and hard-delete card metadata after the Stripe
 * customer itself is deleted (Step 8 calls this only after a successful
 * `customers.del`). `userPaymentMethods` cascades on user delete but this is
 * a purge of a *live* row, not account deletion, so it's an explicit delete. */
async clearStripeCustomerAfterRetentionPurge(userId: string): Promise<void> {
  try {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(userPaymentMethods)
        .where(eq(userPaymentMethods.userId, userId));
      await tx
        .update(user)
        .set({ stripeCustomerId: null })
        .where(eq(user.id, userId));
    });
  } catch (error) {
    this.handleError(error, "clearStripeCustomerAfterRetentionPurge");
  }
}
```

(Import `lt`/`asc`/`isNotNull` from `drizzle-orm` if missing.)

**Verify**: `bun run type-check` → exit 0.

### 8 (retention window): The cron

New `src/app/api/cron/purge-deleted-user-stripe-data/route.ts`, matching
`release-reviews/route.ts`'s shape:

```ts
import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { accountDeletionDAL } from "@/dal";
import { PAYMENT_SERVER_INSTANCE } from "@/services/stripe/server";
import { CronRunHistoryService } from "@/features/admin/services/cron-run-history-service";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import Stripe from "stripe";

export const maxDuration = 60;
const JOB_NAME = "purge-deleted-user-stripe-data";
const BATCH_SIZE = 50;

async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const startedAt = new Date();
  const eligible =
    await accountDeletionDAL.findUsersDueForStripeRetentionPurge(BATCH_SIZE);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id: userId, stripeCustomerId } of eligible) {
    try {
      // A chargeback after deletion auto-creates a dispute; keep the customer
      // while one is open (Decision 3). Retried on a later run.
      if ((await accountDeletionDAL.countOpenDisputes(userId)) > 0) {
        skipped++;
        continue;
      }
      try {
        await PAYMENT_SERVER_INSTANCE.customers.del(stripeCustomerId);
      } catch (error) {
        // Already deleted (a retried run, or deleted by hand) is not a failure.
        const alreadyGone =
          error instanceof Stripe.errors.StripeInvalidRequestError &&
          error.code === "resource_missing";
        if (!alreadyGone) throw error;
      }
      await accountDeletionDAL.clearStripeCustomerAfterRetentionPurge(userId);
      succeeded++;
    } catch (error) {
      failed++;
      await sendOpsAlert({
        event: "stripe_retention_purge_failed",
        message: error instanceof Error ? error.message : "Unknown error",
        metadata: { userId },
        sendEmailAlert: true,
      }).catch(() => {});
    }
  }

  await CronRunHistoryService.recordRun({
    jobName: JOB_NAME,
    startedAt,
    completedAt: new Date(),
    status: failed > 0 && succeeded === 0 ? "failure" : "success",
    recordsEligible: eligible.length,
    recordsSucceeded: succeeded,
    recordsFailed: failed,
  });

  return NextResponse.json({
    success: true,
    eligible: eligible.length,
    succeeded,
    failed,
    skipped,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/cron/purge-deleted-user-stripe-data",
);
```

Wrap the handler body after the auth check in `try`/`catch` the way
`release-reviews/route.ts` does: on a thrown error (e.g. the eligibility
query), record a `failure` run with `errorMessage`, alert ops, and return 500.
A skipped user (open dispute) stays first in `anonymizedAt` order. At 50 per
run that only starves the queue if 50+ deleted users all have open disputes;
acceptable, and noted in Maintenance.

Add to `.github/workflows/cron-jobs.yml`'s `daily` job (after `Monitor
deposit expiry`, alongside the other alert-and-continue steps):

```yaml
- name: Purge deleted-user Stripe data
  id: purge-deleted-user-stripe-data
  continue-on-error: true
  run: |
    curl --fail --max-time 90 -s -X GET \
      -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
      ${{ vars.NEXT_PUBLIC_APP_URL }}/api/cron/purge-deleted-user-stripe-data
```

and add `"${{ steps.purge-deleted-user-stripe-data.outcome }}"` to the
`daily` job's `Check job status` step's list.

**Verify**: `bun run type-check` → exit 0;
`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cron-jobs.yml'))"`
→ no error. New route test
(`src/app/api/cron/purge-deleted-user-stripe-data/__tests__/route.test.ts`,
mock `PAYMENT_SERVER_INSTANCE.customers.del` and `accountDeletionDAL`):
a customer delete succeeding calls `clearStripeCustomerAfterRetentionPurge`;
a `StripeInvalidRequestError` with `code: "resource_missing"` still calls it
(already gone, not a failure); a user with an open dispute is skipped (no
`customers.del`, no clear, counted in `skipped`); any other Stripe error alerts ops and leaves that user's row
untouched so the next run retries; the cron auth gate is covered by the
existing "all cron routes require the secret" gating test — add this route
to that test's list if it enumerates routes explicitly, and to
`src/app/api/cron/__tests__/cron-history-recording.test.ts` if it lists
routes.

### 9: Full regression

**Verify**: `bun run test:run` → all pass.

## Test plan

Covered inline per step: signed-URL substitution and graceful degradation to
`null` for both agreement routes (Step 3); owner-side projection tests for
the two lending list DAL methods, the shared detail mapper, and the
notification/email content (Steps 4-6); a retention-window DAL query test
(seed one user anonymized 121 days ago with a `stripeCustomerId`, one
anonymized 10 days ago — only the first is returned) and the purge cron's
outcomes: purged, already gone, skipped for an open dispute, and a Stripe
error (Steps 7-8). Also: the blob helpers' private/public split and
`clientAgreementUrl`'s pass-through (Step 1), and the two redirect routes
(Step 3b). No real-DB test is strictly required by the house rule ("any
money race or CAS gets one") since none of this is a race. The retention
query (cutoff, `NULL anonymizedAt`, the open-dispute skip via
`countOpenDisputes`) still gets one in
`src/dal/__tests__/account-deletion.integration.test.ts`. Unit tests mock
`@vercel/blob`, so they can't prove a presigned URL actually opens. That is
checked by hand on staging (Done criteria). Full regression:
`bun run test:run`.

## Done criteria

- [ ] `bun run type-check && bun run lint` → exit 0
- [ ] `bun run test:run` → exit 0
- [ ] `docker compose up -d && bun run db:push:e2e && bun run test:integration` → exit 0
- [ ] A newly generated agreement PDF is uploaded `access: "private"` with
      the private store's token (test)
- [ ] **Staging, by hand**: approve a rental; `curl -sI "<agreement.pdfUrl from
  GET /api/rentals/[id]>"` with no auth → `200`, `content-type:
  application/pdf`; `curl -sI` on the stored `rental_agreement_documents.pdf_url`
      → `403`/`404`; the same `pdfUrl` after 11 minutes → rejected; the web
      detail page's agreement button opens the PDF via the redirect route
- [ ] A template-tier agreement URL (public store) is returned unchanged by
      both the API and the redirect route (test)
- [ ] `GET /api/rentals/[id]` and `GET /api/services/bookings/[id]` return a
      signed URL, not the raw stored blob URL, for `agreement.pdfUrl` (test)
- [ ] The web rental and service-booking detail pages never put a private
      agreement's stored URL in the RSC payload; their button goes through
      the session-checked redirect route (tests)
- [ ] `BLOB_PRIVATE_READ_WRITE_TOKEN` cutover row added and done for dev +
      staging
- [ ] No log line anywhere in the agreement-generation path contains the blob
      URL (test)
- [ ] `GET /api/rentals/lending/*` responses and `GET /api/rentals/[id]`
      viewed by the owner never contain `paymentFailureReason` (test)
- [ ] The owner's payment-failure email/notification contains no decline
      reason (test)
- [ ] A user anonymized more than 120 days ago with a Stripe customer is
      purged by the new cron; one anonymized more recently is not (test)
- [ ] No files outside Scope modified (`git status`)
- [ ] Status row updated in `plans/backend-audit/10-remediation-roadmap.md`
      (Phase 2, "Privacy retention")

## STOP conditions

- Any "Current state" excerpt doesn't match live code (drift since `29fe557`).
- `issueSignedToken`/`presignUrl` don't exist or have a different signature
  than described here on the installed `@vercel/blob` version — re-check
  `node_modules/@vercel/blob/package.json`'s version and the type defs before
  forcing a mismatch with `as`; this is the whole basis for avoiding a custom
  streaming/HMAC route.
- A consumer (web or mobile) is found that fetches the agreement URL with
  `fetch()` (reading the body) instead of navigating to it. The web redirect
  route and the signed URL both assume navigation.
- `BLOB_PRIVATE_READ_WRITE_TOKEN` isn't provisioned in the environment you're
  testing against. Don't fall back to the public store; stop and ask for
  the private store (Production cutover).
- A test fails twice after a reasonable fix attempt.

## Mobile compatibility

**Shipped binaries** open whatever `pdfUrl` the screen rendered. The detail
query refetches on mount (30s `staleTime`) and on app focus, so the usual
path (open detail, tap agreement) gets a fresh URL. A screen left open
longer than the TTL shows Vercel's error page in the in-app browser, with no
toast; backing out and reopening the screen fixes it. Accepted until the
follow-up below ships. If that's too rough, raise
`AGREEMENT_SIGNED_URL_TTL_MS` (max 7 days); a longer TTL trades against
leaked-link lifetime.

**`agreement.pdfUrl` changes shape but not type.** It is still a string URL
in the same JSON position on `GET /api/rentals/[id]` and `GET
/api/services/bookings/[id]` — just no longer permanently valid. Per cross-plan
decision 3, this is exactly the form mobile's `native/pdf.ts` already expects
(opens `agreement.pdfUrl` in an in-app browser with no session cookie) — a
presigned Vercel Blob URL is fetchable the same way a public one was, just
time-limited. **No schema change** (`hoador-mobile/src/api/contract`'s
rental/booking-detail schemas already type this field as a plain string) —
but add this row to the roadmap's Mobile client follow-ups table as a
**behavioral** note, not a schema change:

| Fix       | Contract change                                                                                                              | Where the app sees it                                    | Mobile task | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-PRIV-05 | `agreement.pdfUrl` is now a signed URL valid for ~10 minutes from when the detail response was fetched, not a permanent link | Rental detail, service booking detail — agreement viewer | —           | TODO: in `openAgreement` (`rental-detail-screen.tsx:160`, `service-booking-detail-screen.tsx:~176`), refetch the detail (`queryClient.fetchQuery({ queryKey, staleTime: 0 })`) and open the fresh `pdfUrl`, not the rendered one. Today the detail query has `staleTime: 30_000` and is persisted to MMKV for 24h, so a screen left open (or restored offline) past 10 min opens an expired link. `openDocument` then reports `ok: true` (the browser opened, showing Vercel's 403 page), so no error toast appears. |

The R-PRIV-09 mobile follow-up also flagged copy that this plan makes true
rather than aspirational — in
`hoador-mobile/src/features/profile/components/delete-account-screen.tsx:36`:

```
'Rental and service agreements are kept too, and may stay reachable at links someone already has.'
```

That line was accurate before this plan (public, permanent URLs) and is
**false** after it (private blobs, no durable public link) — **but only for
agreements generated after deploy**, or for all of them if the cutover
backfill below is done. Ship the copy change only after that decision. Suggested
replacement, for whoever picks up the mobile follow-up:

```
'Rental and service agreements are kept for our records, but are no longer reachable by anyone without a live session as a party to that booking.'
```

Add a row for this too:

| Fix       | Contract change                                                             | Where the app sees it            | Mobile task | Status                                                                         |
| --------- | --------------------------------------------------------------------------- | -------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| R-PRIV-05 | No wire change — but PRIV-09's deletion-consequences copy is now inaccurate | Delete-account screen (D-E14-10) | —           | TODO: update the "may stay reachable" line per the suggested replacement above |

**PRIV-08, checked against the app.** The only reader is
`rental-detail-screen.tsx:272`, which renders `data.paymentFailureReason`
under the Payment section for **whichever party receives it**. So today the
owner sees the renter's decline reason on mobile too. The contract types it
`z.string().nullable().optional()` (`rental-detail.contract.ts:129`), so an
omitted key parses. After this plan the owner sees only the payment status
line ("Payment failed", from `PAYMENT_COPY`) and the renter still sees the
reason. No lending-list screen reads the field. No mobile follow-up is
needed; the screen's own comment ("neither side ever sees card details") is
now closer to true. The retention-window purge is server/cron-only, no wire
effect.

## Production cutover

Add to `13-production-cutover.md`:

- **No migration** — no schema change (Decision 1 reuses `anonymizedAt`).
- **New B-row (before deploy)**: `R-PRIV-05 — create a private Blob store and
set BLOB_PRIVATE_READ_WRITE_TOKEN` | From: R-PRIV-05 | dev: TODO |
  staging: TODO | prod: TODO. Per environment:
  `vercel blob create-store hoador-agreements-<env> --access private` (or
  Dashboard → Storage → Blob → access **Private**); connect it to the project
  **without** letting it replace the existing public store's
  `BLOB_READ_WRITE_TOKEN`; copy its read-write token into
  `BLOB_PRIVATE_READ_WRITE_TOKEN` for that environment (Vercel env + local
  `.env.local`). Without it, agreement generation fails after deploy (by
  design, never public), so it must exist first. Then run the staging
  hand-check from Done criteria.
- **New row**: `R-PRIV-05 — confirm the new daily cron step (`purge-deleted-user-stripe-data`) appears in the next daily GitHub Actions run` | From: R-PRIV-05 | dev: n/a | staging: TODO | prod: TODO.
- **New row**: `R-PRIV-05 — existing public agreement PDFs stay public
(cutover)` | From: R-PRIV-05 | dev: TODO | staging: TODO | prod: TODO.
  This plan only changes uploads **going forward** — every
  `rental_agreement_documents`/`service_agreement_documents` row created
  before deploy still points at a public, permanent blob URL, and this plan
  does not migrate them. Those rows keep working, because
  `clientAgreementUrl` passes a public URL through unchanged. Stores
  can't change access mode, so moving one means **copying the bytes**:
  `fetch` the public blob, `put` it to the private store at the same
  pathname (`access: "private"`, private token), update the row's
  `pdf_url` to the new URL, then `del` the public blob. Don't regenerate
  it: the signed agreement must stay byte-identical to what the parties
  accepted, and the template may have changed since. Decide and record
  here whether to run that one-off script or accept that pre-deploy
  agreements stay at their public URLs. Prod launches with the fix, so it
  is N/A there. Dev/staging agreements are test data, so N/A is
  reasonable.

## Maintenance notes

- Damage photos and dispute evidence remain public with harder-to-guess
  paths — the finding names this but neither the roadmap's Phase 2 step 6
  nor its recommended fix schedule it here. A follow-up plan could reuse
  `issueSignedBlobUrl` directly for both once someone schedules that work.
- `issueSignedBlobUrl`'s TTL is a plain constant, not configurable per
  caller beyond the parameter — if a future private-blob consumer needs a
  different TTL (e.g. a much shorter one for a one-time download link),
  it already can, by passing its own `ttlMs`.
- `issueSignedToken` is a Blob control-API round trip on every detail
  request that has a private agreement. If detail latency shows it, cache
  one delegation per pathname until shortly before its `validUntil` (the
  Vercel docs suggest exactly this) and only re-run `presignUrl` (local HMAC).
- **R-ARCH-09** adds a zod env schema that lists `BLOB_READ_WRITE_TOKEN`.
  Whichever lands second adds `BLOB_PRIVATE_READ_WRITE_TOKEN` next to it
  (required in production).
- The purge cron processes the 50 oldest eligible users per run and skips
  ones with open disputes. If 50+ eligible users ever all have open
  disputes, the queue stalls; exclude them in the query then.
