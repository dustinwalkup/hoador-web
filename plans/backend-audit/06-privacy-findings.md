# Data privacy and information-exposure findings

Covers what each API returns to whom, logging/telemetry, blob storage, account deletion and on-device storage. Proportionality applied: email, phone, home address, precise location and financial data are treated as sensitive; display names and avatars are expected in a neighborhood marketplace.

How to read this document:

- IDs are the audit's final IDs (see `09-priority-matrix.md`). Each finding lists the auditor report(s) it was consolidated from; duplicates reported by several auditors were merged into one finding.
- Every CRITICAL/HIGH finding was re-verified by the lead auditor against the source code in a second, adversarial pass; the verdict box says what was checked and whether the grade changed. MEDIUM/LOW findings were spot-checked, not all independently re-traced.
- "Auditor's original grading" preserves the auditor's own severity and confidence line; the headline severity above it is the final one.
- Paths are relative to `hoador-web/` unless prefixed `hoador-mobile/` or `m:` (mobile). References such as "Open question 1" point to the auditor open questions reproduced at the end of this document.
- Audited at `hoador-web` develop `21bdc61` (2026-09-23). Read-only: no application code was changed.

## Summary

Findings in this document: CRITICAL 1 · HIGH 2 · MEDIUM 6 · LOW 5.

| ID      | Severity | Confidence | Finding                                                                                                                                                  | Plan                                                                 |
| ------- | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| PRIV-01 | CRITICAL | High       | Rental detail exposes the counterparty's email and phone and the owner's home street address at every status; request→read→cancel harvests them at scale | [R-PRIV-01](remediations/R-PRIV-01-rental-detail-contact-harvest.md) |
| PRIV-02 | HIGH     | High       | Unrounded server-side distances let any member trilaterate listers' and need-posters' home coordinates                                                   | [R-PRIV-02](remediations/R-PRIV-02-distance-oracle.md)               |
| PRIV-03 | HIGH     | High       | Service-listing detail sends the provider's email address to every viewer                                                                                | [R-PRIV-03](remediations/R-PRIV-03-provider-email-exposure.md)       |
| PRIV-04 | MEDIUM   | High       | Service-booking list and payment-lifecycle routes return counterparty email, payout amounts and Stripe object ids                                        | —                                                                    |
| PRIV-05 | MEDIUM   | High       | Rental/service agreement PDFs (names, home address, totals) are public blobs at deterministic URLs, logged, never deleted                                | —                                                                    |
| PRIV-06 | MEDIUM   | High       | Server logs capture session-creating verification URLs and email addresses                                                                               | —                                                                    |
| PRIV-07 | MEDIUM   | Medium     | Server Sentry is configured with sendDefaultPii and attaches email, session cookie and IP to captured errors                                             | —                                                                    |
| PRIV-08 | MEDIUM   | High       | A renter's card-decline reason (e.g. 'Insufficient funds') is shown and emailed to the owner                                                             | —                                                                    |
| PRIV-09 | MEDIUM   | High       | Account deletion leaves recoverable PII (public blobs, delivery/attribution fields, activity IPs, push tokens, Stripe objects)                           | —                                                                    |
| PRIV-10 | LOW      | High       | Moderation internals (rejection reasons, reviewer ids, admin notes) are sent to browsers                                                                 | —                                                                    |
| PRIV-11 | LOW      | High       | Client-supplied image URLs (avatar, damage photos) let a user track everyone who views them                                                              | —                                                                    |
| PRIV-12 | LOW      | High       | Signup confirms whether an email address is registered                                                                                                   | —                                                                    |
| PRIV-13 | LOW      | High       | GET /api/reviews skips the visibility and party checks                                                                                                   | —                                                                    |
| PRIV-14 | LOW      | High       | Mobile persists the whole React Query cache unencrypted in MMKV                                                                                          | —                                                                    |

## Findings

### PRIV-01: Rental detail exposes the counterparty's email and phone and the owner's home street address at every status; request→read→cancel harvests them at scale

**Severity:** CRITICAL · **Confidence:** High · **Auditor source(s):** PRIV-01, SURF-08
**Remediation plan:** [R-PRIV-01](remediations/R-PRIV-01-rental-detail-contact-harvest.md)

> **Adversarial review (lead auditor):** CRITICAL confirmed. Verified line by line: the request branch of `getRentalDetailsById` loads the full owner row and primary address and returns `ownerEmail`, `ownerPhone`, `renterEmail`, `renterPhone` and `pickupAddress` (`src/dal/rentals.dal.ts:2302-2374`) at every status; the route checks party membership only and spreads the object (`src/app/api/rentals/[id]/route.ts:118,174-175`). Becoming a party costs nothing: `paymentMethodId` accepts any string (`src/features/rentals/lib/form-schema.ts:19`), the quote has no visibility or listing-status check (BIZ-08), and a pending request can be cancelled for free. The route-inventory auditor rated the same data flow MEDIUM because it considered only the counterparty relationship; the request→read→cancel loop is what makes it bulk harvesting.

- _Auditor's original grading:_ CRITICAL | **Confidence:** High. Any verified account can script this against every listing owner it can see.
- **Files:**
  - `src/dal/rentals.dal.ts:2302-2323,2339-2340,2354-2355,2374` (and the rental branch, `:2517-2579`)
  - `src/app/api/rentals/[id]/route.ts:118,174-175`
  - `src/features/rentals/lib/form-schema.ts:19`
  - `src/features/rentals/services/rental-quote.ts:94`
  - `m:src/features/rentals/components/rental-detail-screen.tsx:347-350`
- **Affected routes:** GET /api/rentals/[id]; POST /api/rentals; POST /api/rentals/[id]/cancel. The web detail page renders the same object.
- **Relevant code:**

```ts
2302        const owner = await this.db.query.user.findFirst({          // full user row
2322          ? `${ownerAddress.street}, ${ownerAddress.city}, ${ownerAddress.state} ${ownerAddress.zipCode}`
2339          renterEmail: renter?.email || "",
2340          renterPhone: renter?.phone || undefined,
2354          ownerEmail: owner?.email || "",
2355          ownerPhone: owner?.phone || undefined,
2374          pickupAddress,
118    if (!isAdmin && data.renterId !== userId && data.ownerId !== userId) {  // party check only; no status gate
175      ...data,
19    paymentMethodId: z.string().min(1, "Payment method is required"),        // any string passes
```

- **What is wrong:**
  - The renter gets the owner's email, phone and street address as soon as the request exists. They keep them after a decline, cancel or expiry.
  - The owner gets the renter's email and phone before approving.
  - `quoteRentalRequest` (`:94`) checks neither listing status nor community visibility.
  - A pending request can be cancelled for free.
- **Exploit:**
  1. Verify a throwaway email. The `emailVerified` gate in `src/proxy.ts` is the only barrier.
  2. Self-select a community.
  3. Collect listing IDs from `/api/listings/search?limit=100`.
  4. For each listing: POST /api/rentals with `{paymentMethodId:"x"}`, then GET /api/rentals/{id}, then POST cancel.
  5. Combined with SEC-08, this works platform-wide.
- **Mitigating layers checked:**
  - Mobile deliberately does not parse email or phone (`m:src/api/contract/rental-detail.contract.ts:22-25`), but it does render "Pickup from <address>" on pending requests.
  - There is no rate limit.
  - The owner's notification fires only after the data has been read.
- **Real-world impact:** Neighbours' addresses, phones and emails can be harvested at scale. That enables stalking, burglary timed to rental dates, and spam.
- **Recommended fix:**
  - Replace the spread with an explicit allowlist, as P-E9-3 did for service bookings.
  - Drop the `*Email` and `*Phone` fields entirely.
  - Send `pickupAddress` only to the renter, and only while status is approved, active or completed.
  - In `createRentalRequest`, require a browseable listing the viewer can see and a `paymentMethodId` that belongs to the renter.
- **Tests needed:**
  - Pending, declined and cancelled requests contain no address, email or phone (grep the serialized body).
  - The owner never receives renter contact details.
  - A request against a listing the renter cannot see is refused.
- **Related:** 02, 06, 07, 11.

### PRIV-02: Unrounded server-side distances let any member trilaterate listers' and need-posters' home coordinates

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** PRIV-02
**Remediation plan:** [R-PRIV-02](remediations/R-PRIV-02-distance-oracle.md)

> **Adversarial review (lead auditor):** Verified: PostGIS `ST_Distance(...)/1609.34` (`src/dal/listing.dal.ts:174-182`, returned at `:1009`) and a raw haversine for needs (`src/dal/neighborhood-needs.dal.ts:392-412`) are serialized unrounded, and the viewer can move their own reference point with `PATCH /api/profile` (address). Stealthier than PRIV-01: the target is never notified.

- _Auditor's original grading:_ HIGH | **Confidence:** High. The attacker chooses their own reference point.
- **Files:**
  - `src/dal/listing.dal.ts:177-182,988-992,1009`
  - `src/dal/neighborhood-needs.dal.ts:395-412,529-541`
  - `src/app/api/profile/route.ts:93-96`
  - `src/dal/user.dal.ts:634-678`
- **Affected routes:** GET /api/listings/search (including `sortBy=distance`), GET /api/needs, GET /api/needs/[id].
- **Relevant code:**

```ts
179                ST_Point(${userLocation.longitude}::float, ${userLocation.latitude}::float)::geography,
180                ST_Point(${userAddresses.longitude}::float, ${userAddresses.latitude}::float)::geography
1009            distanceMiles,                         // raw double in JSON
397            ? haversineMiles(viewerLocation, {   // needs: requester's home, unrounded
```

- **What is wrong:**
  - The route returns the exact distance between two geocoded homes.
  - Rounding happens only in client formatters (`src/lib/utils/geo.utils.ts:39-46`).
  - The viewer can move their own home with PATCH /api/profile `address`.
- **Exploit:** Set the attacker's address to A, B and C in turn. At each point, read every search and needs page. Intersecting the three circles gives the target's rooftop point to within about a metre.
- **Mitigating layers checked:** Owner lat/lng are never serialized. The 5-minute location cache in the listing DAL only slows the attack, and the needs routes have no cache.
- **Real-world impact:** Precise home location of every lister and need poster in visible communities, or on the whole platform with SEC-08.
- **Recommended fix:**
  - Return bucketed distances from the server, or measure from the community centroid.
  - Sort over the buckets.
  - Rate-limit and audit address changes.
- **Tests needed:** Viewer points 10 m apart get identical responses.
- **Related:** 01, 06.

### PRIV-03: Service-listing detail sends the provider's email address to every viewer

**Severity:** HIGH · **Confidence:** High · **Auditor source(s):** PRIV-03
**Remediation plan:** [R-PRIV-03](remediations/R-PRIV-03-provider-email-exposure.md)

> **Adversarial review (lead auditor):** Verified: `provider.email` is selected (`src/dal/service-listing.dal.ts:178-184`) and the route returns `{ ...listing, isProvider }` (`src/app/api/services/listings/[id]/route.ts:76`). The mobile contract strips it client-side only.

- _Auditor's original grading:_ HIGH | **Confidence:** High.
- **Files:**
  - `src/dal/service-listing.dal.ts:183`
  - `src/app/api/services/listings/[id]/route.ts:76`
  - `m:src/api/contract/services.contract.ts:76-78` (F15: "the route returns the row verbatim")
- **Affected routes:** GET /api/services/listings/[id]. IDs come from GET /api/services/listings.
- **Relevant code:** `183            email: user.email,` flows into `76    return NextResponse.json({ ...listing, isProvider });`
- **What is wrong:** `provider.email` goes to every visible member. Mobile strips it on the client only.
- **Exploit:** Browse the service listings, then fetch each detail.
- **Mitigating layers checked:** The visibility gate only narrows the audience to members, who should not receive emails either.
- **Real-world impact:** Every service provider's email can be harvested.
- **Recommended fix:** Project the provider to `{id, firstName, lastName, profileImageUrl}`. Drop `adminNote` and `rejectionReason` for non-providers.
- **Tests needed:** A non-provider response contains no email and no `adminNote`.
- **Related:** 04, 13.

### PRIV-04: Service-booking list and payment-lifecycle routes return counterparty email, payout amounts and Stripe object ids

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PRIV-04, TRUST-03, SURF-04

> **Adversarial review (lead auditor):** Kept MEDIUM (parties only). The payment-method id in the same payload is what enables SEC-07.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. Only parties see it, but the data arrives before acceptance and is never needed.
- **Files:**
  - `src/dal/service-booking.dal.ts:755-790,796-830`
  - `src/app/api/services/bookings/route.ts:51`
  - `src/app/api/services/bookings/[id]/payment-lifecycle/route.ts` (returns the `select()` row)
- **Affected routes:** GET /api/services/bookings?role=; GET /api/services/bookings/[id]/payment-lifecycle.
- **Relevant code:** `768            email: bookingProvider.email,` · `809            email: bookingRequester.email,` · `51    return NextResponse.json({ bookings: data ?? [] });` (rows are built from `...row.booking`)
- **What is wrong:**
  - At every status, the list returns the counterparty's email, the payment intent, charge and refund IDs, and the requester's `pm_` ID.
  - The lifecycle route shows the requester the provider's payout and the transfer and charge IDs.
  - P-E9-3 removed exactly these fields from the detail route (`services/bookings/[id]/route.ts:247-252`). The list and lifecycle routes were missed.
- **Exploit:** A provider collects every requester's email. A requester books and then cancels to get a provider's email.
- **Mitigating layers checked:** A party check exists, but there is no projection.
- **Real-world impact:** Email harvesting, and payment identifiers exposed to a neighbour.
- **Recommended fix:** Project both routes to allowlists. Return lifecycle data to the provider only, without Stripe IDs.
- **Tests needed:** Response bodies contain no `@` address and no `pi_`/`ch_`/`pm_`/`re_`/`tr_` IDs.
- **Related:** 03.

### PRIV-05: Rental/service agreement PDFs (names, home address, totals) are public blobs at deterministic URLs, logged, never deleted

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PRIV-07

> **Adversarial review (lead auditor):** Kept MEDIUM. The request/booking UUID is the only capability, and it travels in emails, push payloads and logs.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. This contradicts `specs/rental-agreement-generation/1-requirements.md:97`, which says non-parties SHALL NOT get access.
- **Files:**
  - `src/services/vercel-blob/index.ts:15-17`
  - `src/services/playwright/generate-rental-agreements/utils.ts:34`
  - `.../get-payload.ts:47-50`
  - `src/app/api/internal/generate-rental-agreement/route.ts:76`
  - `src/features/rentals/services/rental-service.ts:940-942`
- **Affected routes:** PDF URLs returned by the rental and service booking detail routes; the blob CDN.
- **Relevant code:** `16    access: "public",` (in @vercel/blob 2.4.0, `addRandomSuffix` defaults to false) · `34  const filename = \`rental-agreements/${rentalRequestId}.pdf\`;`·`76 console.log("[pdf-gen-route] success", { rentalRequestId, url });`
- **What is wrong:**
  - The URL is `<store>.public.blob.vercel-storage.com/rental-agreements/<requestId>.pdf`. The store host appears on every listing image, and the request ID travels in email links, push payloads, logs and Sentry.
  - The party-only check protects only disclosure of the URL, not the file itself.
  - Dispute evidence and damage photos are also public, with harder-to-guess paths (timestamp plus filename).
- **Exploit:** Anyone who holds a request ID downloads the PDF.
- **Mitigating layers checked:** Request IDs are UUIDs. The URL never expires.
- **Real-world impact:** Home addresses stay public, including after account deletion.
- **Recommended fix:** Use `access: "private"` (or at minimum `addRandomSuffix: true`) behind an authorized route that streams the file or issues signed URLs. Stop logging the URL.
- **Tests needed:** Uploads are private; a non-party download returns 403.
- **Related:** 01, 12.

### PRIV-06: Server logs capture session-creating verification URLs and email addresses

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PRIV-08

> **Adversarial review (lead auditor):** Kept MEDIUM (insider / log-processor exposure; a logged verification URL signs its holder in).

- _Auditor's original grading:_ MEDIUM | **Confidence:** High. Violates LOG-PRIV-001 and LOG-PRIV-004 (`specs/logging/1-requirements.md:103-106`).
- **Files:**
  - `src/services/resend/send-verification-email.ts:20-21`
  - `src/services/better-auth/build-auth-options.ts:133,148,187`
  - better-auth `sign-up.mjs:167`
  - `src/lib/logger/redact.ts:5-29`
- **Affected routes:** signup, resend-verification, password reset.
- **Relevant code:** `21  console.log("Verification URL:", verificationUrl);` · `148      autoSignInAfterVerification: true,` · `133        console.log(\`Password for user ${user.email} has been reset.\`);`
- **What is wrong:**
  - Opening the logged verification URL verifies the email and creates a session.
  - Emails are logged in several places.
  - The redaction list has no email or URL keys, and `console` calls bypass pino entirely.
- **Exploit:** Anyone with log access takes over accounts that are still unverified.
- **Mitigating layers checked:** The token expires after 24 hours.
- **Real-world impact:** Account takeover, and PII in third-party logs.
- **Recommended fix:** Delete these logs, log the userId instead, and set the better-auth logger to `warn`.
- **Tests needed:** A console spy sees no token or email.
- **Related:** 07, 09.

### PRIV-07: Server Sentry is configured with sendDefaultPii and attaches email, session cookie and IP to captured errors

**Severity:** MEDIUM · **Confidence:** Medium · **Auditor source(s):** PRIV-09

> **Adversarial review (lead auditor):** Kept MEDIUM. New evidence against the earlier 'speculative' rejection: the config and user context set PII explicitly.

- _Auditor's original grading:_ MEDIUM | **Confidence:** Medium. Sentry's project-side scrubbing can't be seen from code.
- **Files:**
  - `src/lib/api/route-helpers.ts:54-57`
  - `src/lib/sentry/user-context.ts:14-18`
  - `sentry.server.config.ts:31`
  - `@sentry/core` 10.46.0 `integrations/requestdata.js:8-14`
  - `@sentry/node-core` `httpServerIntegration.js:114-125`
- **Affected routes:** Every error path through `handleApiError` or `withRequestLogging`.
- **Relevant code:** `16    email: user.email || undefined,` · `31    sendDefaultPii: true,` · `const DEFAULT_INCLUDE = { cookies: true, data: true, headers: true, ... }`
- **What is wrong:**
  - The earlier rejection assumed "error classes carry no PII". This is different evidence: the user context sets the email explicitly.
  - RequestData ships headers, including the `better-auth.session_token` cookie and the mobile `Cookie` header, plus the IP.
  - SEC-16 also puts PII into error messages.
- **Exploit:** Anyone with Sentry access can reuse session tokens.
- **Mitigating layers checked:** `beforeSend` only filters by status and message.
- **Real-world impact:** Credentials and PII spread to a third party.
- **Recommended fix:**
  - Set `sendDefaultPii: false`.
  - Use `requestDataIntegration({ include: { cookies: false, headers: false, ip: false } })`.
  - Set only `setUser({ id })`.
  - Add a scrubber like `m:src/lib/sentry-scrub.ts`.
- **Tests needed:** Unit-test the options and the scrubber.
- **Related:** 10.

### PRIV-08: A renter's card-decline reason (e.g. 'Insufficient funds') is shown and emailed to the owner

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PRIV-11

> **Adversarial review (lead auditor):** Kept MEDIUM.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High.
- **Files:**
  - `src/services/stripe/rental-payments.ts:150-151`
  - `src/dal/rentals.dal.ts:938,1674,2391`
  - `src/features/rentals/notifications/payment-failure.ts:173,212`
- **Affected routes:** GET /api/rentals/lending/\*; GET /api/rentals/[id]; the owner's notification and email.
- **Relevant code:** `151        return "Insufficient funds on the payment method.";` · `212              <p ...>${failureReason}</p>` (owner email)
- **What is wrong:** `paymentFailureReason` is included in owner-side payloads and notification `data`.
- **Exploit:** None needed; the owner receives it passively.
- **Mitigating layers checked:** None.
- **Real-world impact:** A neighbour learns someone's financial status.
- **Recommended fix:** Tell the owner "payment could not be processed" and keep the reason renter-only.
- **Tests needed:** Owner payloads and email contain no reason.
- **Related:** 01.

### PRIV-09: Account deletion leaves recoverable PII (public blobs, delivery/attribution fields, activity IPs, push tokens, Stripe objects)

**Severity:** MEDIUM · **Confidence:** High · **Auditor source(s):** PRIV-12

> **Adversarial review (lead auditor):** Kept MEDIUM; the retention boundary is partly a policy decision.

- _Auditor's original grading:_ MEDIUM | **Confidence:** High for the facts; how much retention is acceptable is a policy decision.
- **Files:**
  - `src/dal/account-deletion.dal.ts:293-351` (Stripe objects kept deliberately at `:306-308`)
  - `src/features/users/services/account-deletion-service.ts:107-135`
- **Affected routes:** DELETE /api/users/me.
- **Relevant code:** `306            // stripeCustomerId / stripeConnectedAccountId are kept: pseudonymous`. The flow never calls `deleteFromBlob`.
- **What is wrong:**
  - **Removed:** user-row PII, addresses, sessions, accounts.
  - **Kept:**
    - All public blobs: profile photo, listing photos, damage photos, dispute evidence, and agreement PDFs that contain the home address.
    - `rental_requests` delivery fields, `message` and `attributionContext` (IP, user agent, fbp/fbc).
    - `user_activity_log` IPs.
    - Push tokens and card last4/expiry (deactivated, not deleted).
    - The Stripe customer and Connect identity, with no scheduled deletion.
- **Exploit:** Previously seen URLs keep working after deletion.
- **Mitigating layers checked:** Req 2.5.1 requires keeping only financial, dispute and audit rows.
- **Real-world impact:** The deletion promise is only partly kept.
- **Recommended fix:**
  - Delete the user's blobs.
  - Null the delivery and attribution fields.
  - Purge activity, push and card rows.
  - Delete the Stripe customer after the retention window.
- **Tests needed:** The anonymize DAL test asserts each table plus a blob-delete mock.
- **Related:** 07.

### PRIV-10: Moderation internals (rejection reasons, reviewer ids, admin notes) are sent to browsers

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PRIV-13

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High.
- **Files:**
  - `src/dal/listing.dal.ts:995,2068,2079`
  - `src/app/api/listings/[listingId]/route.ts:107`
  - `src/features/services/services/service-listing-service.ts:460-467`
  - `src/features/disputes/lib/participant-view.ts:306-310`
- **Affected routes:** Listing search; service detail, browse and provider profile; dispute list.
- **Relevant code:** `995            ...item.listing,` · `2079        updateData.rejectionReason = appendReviewScalar(` (never cleared on approval)
- **What is wrong:**
  - Search returns the accumulated `rejectionReason` and the reviewing admin's ID. The detail route strips these fields (Req 6.1.3), but search does not.
  - Service `adminNote` goes to every viewer.
  - Dispute list rows keep `resolvedBy` and `stripeChargebackId`.
- **Exploit:** None needed; the data is sent to every viewer.
- **Mitigating layers checked:** The listing detail route strips these fields.
- **Real-world impact:** Moderation history and admin IDs leak.
- **Recommended fix:** Use explicit projections.
- **Tests needed:** Assert these fields are absent.
- **Related:** 03.

### PRIV-11: Client-supplied image URLs (avatar, damage photos) let a user track everyone who views them

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PRIV-14

> **Adversarial review (lead auditor):** Kept LOW. Overlaps SEC-11 and SEC-22.

- _Auditor's original grading:_ LOW | **Confidence:** High.
- **Files:**
  - `src/features/users/lib/profile.schema.ts:19,49`
  - `src/app/api/rentals/[id]/end/route.ts:37`
  - `m:src/lib/image-url.ts:31`
- **Affected routes:** PATCH /api/profile; POST /api/rentals/[id]/end; every avatar surface, including the needs feed.
- **Relevant code:** `19 const profileImageUrl = z.string().url();` · `37    damagePhotos: z.array(z.string().url())...`
- **What is wrong:** Any host is accepted, and mobile fetches any absolute URL. These images also skip EXIF stripping.
- **Exploit:** Point the avatar at an attacker's host. Each viewer's IP, user agent and viewing time get logged there.
- **Mitigating layers checked:** Service photos are already guarded against this (`service-listing-service.ts:294-296`); these two fields are not.
- **Real-world impact:** IP harvesting and read receipts.
- **Recommended fix:** Accept only URLs on our blob store under the caller's prefix, or set the URL server-side.
- **Tests needed:** A foreign host returns 400.
- **Related:** 12.

### PRIV-12: Signup confirms whether an email address is registered

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PRIV-15

> **Adversarial review (lead auditor):** Kept LOW.

- _Auditor's original grading:_ LOW | **Confidence:** High.
- **Files:**
  - `src/features/auth/services/auth-service.ts:48-51`
  - `src/services/better-auth/build-auth-options.ts:109-111`
  - better-auth `sign-up.mjs:161,207`
- **Affected routes:** POST /api/auth/signup.
- **Relevant code:** `49        throw new ConflictError(` with the message "An account with this email already exists."
- **What is wrong:** With `autoSignIn: true` and no `requireEmailVerification`, better-auth skips its generic duplicate-response path. The route has no rate limit.
- **Exploit:** Check whether a specific neighbour has an account.
- **Mitigating layers checked:** Forgot-password and resend-verification are clean.
- **Real-world impact:** Discloses who is a member.
- **Recommended fix:** Return a generic response, email the existing account holder instead, and add a rate limit.
- **Tests needed:** Known and unknown emails get identical responses.
- **Related:** 10.

### PRIV-13: GET /api/reviews skips the visibility and party checks

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PRIV-16

> **Adversarial review (lead auditor):** Kept LOW (released reviews only).

- _Auditor's original grading:_ LOW | **Confidence:** High. Only released reviews are affected.
- **Files:** `src/app/api/reviews/route.ts:58-74,77-87`.
- **Affected routes:** `?revieweeId=`, `?rentalId=`, `?serviceBookingId=`.
- **Relevant code:** `68      const result = await BlindReviewService.getUserReviews(revieweeId, {`
- **What is wrong:** Skips the shared-visibility rule that `providers/[userId]/route.ts:27-50` enforces, and lets non-parties read a booking's reviews.
- **Exploit:** Given any user ID, read that user's reviews across networks.
- **Mitigating layers checked:** Only released reviews are returned.
- **Real-world impact:** Minor.
- **Recommended fix:** Add the visibility and participant checks.
- **Tests needed:** Both cases return 403.
- **Related:** 06.

### PRIV-14: Mobile persists the whole React Query cache unencrypted in MMKV

**Severity:** LOW · **Confidence:** High · **Auditor source(s):** PRIV-17

> **Adversarial review (lead auditor):** Kept LOW (device access required; purged on sign-out).

- _Auditor's original grading:_ LOW | **Confidence:** High.
- **Files:**
  - `m:src/state/mmkv.ts:7`
  - `m:src/state/query-persister.ts:11-13`
  - `m:src/state/query-provider.tsx:25`
- **Affected routes:** Every persisted query, including messages, `pickupAddress`, profile and cards.
- **Relevant code:** `7 export const storage: MMKV = createMMKV({ id: 'hoador-app' });` (no `encryptionKey`, no dehydrate filter)
- **What is wrong:** Messages and addresses sit on disk unencrypted, and `app.config.ts` does not override `allowBackup`.
- **Exploit:** Requires access to the device or its backups.
- **Mitigating layers checked:** The cache is purged on sign-out and on 401 (`m:src/features/auth/lib/sign-out.ts:73,98`).
- **Real-world impact:** Low.
- **Recommended fix:** Exclude sensitive query keys from persistence and encrypt MMKV with a key kept in SecureStore.
- **Tests needed:** A unit test for the dehydrate filter.
- **Related:** none.

## Data exposure matrix (privacy auditor)

| Route                                                                                                                  | Subject                      | Fields                                                                                                    | Audience                   | OK?                    |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------- |
| GET /api/rentals/[id]                                                                                                  | counterparty                 | owner email, phone and full street address; renter email and phone; `paymentFailureReason`; `ownerPayout` | both parties, any status   | **No** (01, 11)        |
| GET /api/listings/search                                                                                               | owners                       | full listing row (`rejectionReason`, `reviewedBy`); float `distanceMiles`                                 | visible members            | **No** (02, 13)        |
| GET /api/needs[/id]                                                                                                    | creator                      | name, avatar, rating; float `distanceMiles`                                                               | visible members            | **No** (02)            |
| GET /api/services/listings/[id]                                                                                        | provider                     | `provider.email`, `adminNote`, `rejectionReason`                                                          | visible members            | **No** (03, 13)        |
| GET /api/services/bookings?role= and /[id]/payment-lifecycle                                                           | counterparty                 | email; Stripe `pi_`/`ch_`/`re_`/`pm_`/`tr_` IDs; provider payout                                          | parties, any status        | **No** (04)            |
| GET /api/rentals/lending/\*                                                                                            | renter                       | name, avatar, `deliveryAddress`, `paymentFailureReason`                                                   | owner                      | reason **No** (11)     |
| GET /api/communities, /users/me/visibility                                                                             | community                    | `joinCode`                                                                                                | any user                   | **No** (05)            |
| GET /api/reviews?revieweeId= / ?rentalId=                                                                              | anyone                       | released reviews, reviewer name and avatar                                                                | any user                   | Weak (16)              |
| GET /api/disputes (list)                                                                                               | counterparty                 | `resolvedBy`, `stripeChargebackId`                                                                        | parties                    | Minor (13)             |
| Blob store                                                                                                             | agreements, evidence, photos | public, suffix-less URLs                                                                                  | anyone with URL            | agreements **No** (07) |
| Listing detail, service booking detail, messages, dispute detail, schedule, dashboard, notifications, provider profile | various                      | narrow projections: names, avatars, city/state                                                            | parties or visible members | Yes                    |

## Verified clean (privacy auditor)

- **Listing detail:** returns an owner projection only; approval fields are stripped (`listing.dal.ts:440-455`, `route.ts:107-110`). Owner coordinates are never serialized.
- **Service booking detail:** uses an allowlist (`services/bookings/[id]/route.ts:322-387`).
- **Schedule and dashboard summary:** narrow projections (`summary/route.ts:97-122`).
- **Messages:** return `participantColumns` only (`messages.dal.ts:37-44`). Neither push nor email carries message content.
- **Dispute detail:** served through `toParticipantDispute` (`participant-view.ts:257-295`). The notes, audit and resolve routes are admin-only.
- **Blind reviews:**
  - Reads filter on `releasedAt` (`blind-review.dal.ts:124-128,217-222`).
  - The aggregate is recomputed only on release (`user.dal.ts:1252-1275`), and the notification is sent only on release.
  - The schedule's reviewable check looks only at the viewer's own review.
- **Push payloads:** use an ID allowlist (`push-payload.ts:95-111`).
- **EXIF:** every server upload is re-encoded by sharp 0.35.1 without `withMetadata` (`src/lib/image/server.ts:25-43`).
- **Request logging:** records route pattern, status and duration only (`with-request-logging.ts:64-83`).
- **Forgot-password and resend-verification:** anti-enumeration (`email-verification.mjs:96-116`).
- **Provider profile:** projected and visibility-gated (`providers/[userId]/route.ts:27-50,116-133`).
- **Payments history:** shows the counterparty's name only.
- **Ops alerts:** contain IDs only.
- **Credential tables:** no app code reads `account` or `session`, and nothing lists blobs.
- **Dead code:** `getRecentListingsNearUser` (`listing.dal.ts:2240`) has no callers.
- **Mobile:** the session lives in SecureStore only (`auth-client.ts:35`). React Native Sentry scrubs headers, cookies and contexts, and calls neither `setUser` nor `sendDefaultPii`.
- **Previously rejected items:** not re-audited. The Sentry item is re-raised only on new evidence (PRIV-07).

## Auditor open questions — privacy

1. What server-side scrubbing is configured in the Sentry project? This decides PRIV-07's real impact.
2. PATCH /api/profile changes `email` without re-verification while `emailVerified` stays true (`profile.schema.ts:46`, `profile/route.ts:83-86`). With Google/Apple account linking, this might allow account pre-hijacking. Not verified; handing to the auth auditor.
3. Product decision for PRIV-01: when, if ever, should the owner's address and phone be revealed?
4. Does the `auth.api.signUpEmail` call path get better-auth's rate limit? This decides PRIV-12's scale.
5. Do backups include the MMKV directory (PRIV-14)?
6. The availability-block `reason` is owner free text shown to renters (for example "on vacation"). Should it be a fixed list instead?
