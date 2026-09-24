# Attack surface map

This map covers every server entry point of `hoador-web`: 162 route files (191 route × method handlers), the `src/proxy.ts` middleware, server-rendered pages that read the DAL directly, the Stripe webhook, crons and internal routes. `hoador-web` is the backend for both the Expo mobile app (primary client) and the retiring web UI, and both are treated as **untrusted clients**: anyone can call any route with any body and headers.

Audited at `hoador-web` develop `21bdc61` (2026-09-23). The route inventory was built by reading each handler. Findings it revealed have been consolidated into the category documents; SURF-nn IDs from the inventory auditor were mapped to final IDs.

## How requests are authenticated (summary)

| Mechanism                  | Where                                                                                                                                                     | Notes                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| better-auth session cookie | `getAuthenticatedUserResponse()` / `requireAuthResponse()` in `src/lib/api/route-helpers.ts` → `getCurrentUser()` in `src/features/auth/utils/session.ts` | The mobile app sends the cookie manually as a `Cookie:` header. **No account-status check** (SEC-01). The session is resolved about 3× per request (PERF-03).                                  |
| Admin role                 | `requireAdminResponse()` / inline `isAdmin`                                                                                                               | Every `/api/admin/**` handler is gated. The superadmin tier is only partly separated (SEC-06).                                                                                                 |
| Middleware                 | `src/proxy.ts`                                                                                                                                            | Enforces auth only for pages and the prefixes `/api/garage`, `/api/listings`, `/api/rentals`, `/api/messages`. Skips `/api/auth*` and `/api/profile*`. All other API routes self-authenticate. |
| Cron bearer secret         | `verifyCronSecret()` (constant-time, fails closed)                                                                                                        | All 13 `/api/cron/*` routes.                                                                                                                                                                   |
| Internal secret            | `INTERNAL_API_SECRET` (constant-time)                                                                                                                     | `/api/internal/generate-*-agreement`.                                                                                                                                                          |
| Stripe signature           | `webhooks.constructEvent` on the raw body                                                                                                                 | `/api/stripe/webhooks`. No event-id dedupe (handlers are state-idempotent; BIZ-14).                                                                                                            |
| Test gate                  | `NODE_ENV !== "production" && E2E_TEST === "1"`                                                                                                           | `/api/test/*`. The better-auth e2e sign-in plugin checks only `E2E_TEST` (SEC-17).                                                                                                             |

## Highest-risk surfaces (from the consolidated findings)

| Surface                                                                                              | Why it matters                                                                 | Findings                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| `GET /api/rentals/[id]` + `POST /api/rentals` + cancel                                               | Contact info and home address can be harvested with a request→read→cancel loop | PRIV-01 (CRITICAL), BIZ-08              |
| `POST /api/rentals/[id]/approve`                                                                     | Charges a renter's card off-session                                            | BIZ-01, CONC-01, BIZ-11, BIZ-12, BIZ-07 |
| `POST /api/rentals/[id]/cancel`, `/start`, `/end`, admin no-show                                     | Refunds, transfers and deposit releases before CAS                             | CONC-02                                 |
| `POST /api/rentals` + `/api/rentals/preview`                                                         | The client sets a price input                                                  | SEC-03                                  |
| `POST /api/services/bookings/[id]/complete`                                                          | Starts the payout clock                                                        | BIZ-02, BIZ-03                          |
| `PATCH /api/disputes/[id]/state`, `POST /api/disputes/[id]/resolve`                                  | Money decisions                                                                | BIZ-05, BIZ-04, CONC-09                 |
| `POST /api/stripe/webhooks` (chargebacks)                                                            | Freezes payouts                                                                | BIZ-06, BIZ-13, BIZ-14                  |
| `PATCH /api/profile`, `POST /api/onboarding`                                                         | Identity and account state                                                     | SEC-02, SEC-01, SEC-11                  |
| `PATCH /api/users/me/visibility`, `GET /api/communities`                                             | Tenant (community) isolation                                                   | SEC-08, SEC-09                          |
| `GET /api/listings/search`, `GET /api/needs`                                                         | Distance oracle                                                                | PRIV-02                                 |
| `DELETE /api/stripe/delete-payment-method`, `GET /api/services/bookings`                             | Payment-method sabotage and leaks                                              | SEC-07, PRIV-04                         |
| `DELETE /api/listings/[listingId]`                                                                   | Cascades away financial records                                                | DB-01                                   |
| Unauthenticated email senders (`/api/auth/*` custom routes, `/api/hoa-inquiries`)                    | Abuse and cost                                                                 | SEC-04, SEC-20                          |
| `POST /api/push/subscribe` + `/api/push/test`, `POST /api/needs`, `POST /api/listings/analyze-image` | Amplification and abuse                                                        | SEC-13, SEC-15, PERF-02, SEC-14         |

## Attack surface summary (inventory auditor)

- **Rows by auth type (191):**

  | Auth        | Rows                                                           |
  | ----------- | -------------------------------------------------------------- |
  | session     | 119                                                            |
  | admin       | 40 (35 under /api/admin plus disputes audit, notes×3, resolve) |
  | superadmin  | 1                                                              |
  | cron        | 13                                                             |
  | none        | 6                                                              |
  | test        | 5                                                              |
  | better-auth | 2                                                              |
  | proxy-only  | 2                                                              |
  | internal    | 2                                                              |
  | webhook-sig | 1                                                              |

- **Unauthenticated routes and justification:**
  - better-auth `[...all]` GET/POST: the auth protocol. Its plugin `/e2e-callback` is gated only by E2E_TEST (SEC-17).
  - `auth/signup`, `forgot-password`, `resend-verification`, `reset-password`: the pre-login funnel. They have no rate limit (SEC-04).
  - `hoa-inquiries`: the logged-out lead form (Req 3.6; SEC-20).
  - `admin/legal-documents/.../download`: **not justified** (SEC-24).
  - Secret-gated only: 13 cron, 2 internal, 1 webhook. The 5 test routes return 404 unless NODE_ENV≠production && E2E_TEST=1 (accepted risk).
- **Money-moving routes:**
  - rentals approve, cancel, retry-deposit
  - services bookings accept, cancel, complete
  - disputes resolve
  - admin release-deposit, reset-payout, reset-transfer, no-show, chargeback-evidence
  - crons process-payouts, process-service-payouts, schedule-deposit-holds, expire-pending-bookings
  - stripe webhooks; stripe delete-payment-method (instrument destruction, SEC-07)
  - pricing inputs: rentals POST (SEC-03), services bookings POST
  - card setup: create-setup-intent, payment-sheet-params, attach, set-default
- **Routes returning other users' PII:**
  - rentals/[id] (counterparty email, phone, owner home address; PRIV-01)
  - services/bookings GET (counterparty email and PM id; PRIV-04)
  - lending/renting lists (names; email not verified)
  - dashboard/summary (requester names)
  - messages (participant names)
  - listings, services, providers, needs detail and reviews (names, avatars, city/state)
  - admin users, activity, pending memberships (email, address)
  - admin disputes (full rows)
  - hoa-inquiries writes applicants' PII to Sheets and email
- **Uploads:**
  - profile/upload (5MB)
  - listings/[listingId] POST (10MB, magic bytes)
  - services photos POST (10MB, magic bytes)
  - rentals damage-photos (no magic-byte check; sharp re-encodes)
  - disputes evidence
  - admin legal upload (PDF)
  - analyze-image sends image URLs or base64 to OpenAI
- **External services:**

  | Service               | Routes                                                                                                                       |
  | --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
  | Stripe                | stripe/_, (payments)/_, rental approve/cancel/retry, booking accept/cancel, dispute resolve, admin payments, crons, users/me |
  | OpenAI                | analyze-image                                                                                                                |
  | Resend                | auth funnel, message/rental/booking/listing notifications, bulk re-engagement, hoa-inquiries, dispute state                  |
  | Vercel Blob           | the uploads above, plus deletes (profile, listing image/delete, service photos PUT, legal delete)                            |
  | Google Sheets         | hoa-inquiries                                                                                                                |
  | Push (Expo, web-push) | sendNotification callers, push/test, check-push-receipts                                                                     |
  | PDF (puppeteer)       | internal/\*, triggered from approve/accept                                                                                   |
  | Meta CAPI             | signup, accept-legal, rental approve                                                                                         |
  | Geocoding             | route-level use unverified                                                                                                   |

- **Routes that accept bodies with no or loose validation:**
  - Raw or manual parsing: notifications POST, stripe attach/set-default, admin users PATCH (no enum), bulk-actions, admin communities POST/PATCH, membership verify/deny, reset-payout/transfer, resend-verification, select-community, test routes.
  - `users/me/visibility` PATCH: has a shape check but no community scope (SEC-08).
  - Zod present but permissive:
    - profile PATCH accepts `email` and any `profileImageUrl` (SEC-02, SEC-11).
    - rentals POST accepts any `setupFee` (SEC-03).
    - analyze-image `imageUrls` array is unbounded.
    - end / instructions strings are unbounded.
  - admin legal DELETE: `blobPathname` is arbitrary.

**Not re-reported** (known, accepted or rejected in `plans/README.md`, no new evidence):

- dispute notes PUT writes before checking membership
- dispute state has no party check
- `/api/test/*` exposure; SEC-17 is a different endpoint and lacks the NODE_ENV guard
- upload rate limiting
- 401 vs 403
- CSRF
- messages read/unread "race"

**Observations below finding threshold:**

- conversation DELETE hard-deletes both parties' history
- messages POST reaches any user id
- reviews `?revieweeId` has no R5 check
- analyze-image array is unbounded (context-limited)
- payment-lifecycle GET returns the full row to the requester
- rental decline has no paymentStatus guard (the known follow-up class)
- admin legal DELETE deletes an arbitrary blob pathname
- `withRequestLogging` resolves the session before the cron secret is checked
- `/test-api` page is still deployed

## Client-controlled input matrix (trust-boundary auditor)

| Route                                           | Client-controlled field                    | Server treatment                                                                | file:line                                                                                 |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| POST /api/rentals, /api/rentals/preview         | `setupFee` (money)                         | **TRUSTED** — overrides listing.setupFee, no non-negative/`setupAvailable` gate | `src/features/rentals/lib/pricing.ts:85-87`, `src/features/rentals/lib/form-schema.ts:16` |
| POST /api/rentals                               | `listingId`, dates, `deliveryRequested`    | Derived/validated in quote (owner, period, availability, prices from listing)   | `src/features/rentals/services/rental-quote.ts:94-178`                                    |
| POST /api/rentals                               | `paymentMethodId`                          | Stored; re-resolved server-side at approve                                      | `src/features/rentals/services/rental-service.ts:212,404-419`                             |
| POST /api/rentals/[id]/approve                  | (path id only)                             | Ownership + atomic claim + Connect gating; amounts from stored row              | `rental-service.ts:389,457`                                                               |
| POST /api/rentals/[id]/cancel,decline,start,end | body reasons/condition                     | Ownership + state guards server-side; refund tiers server-computed              | `src/dal/rentals.dal.ts:1981,2774,2919`; `cancellation-service.ts:126-158`                |
| POST /api/rentals/[id]/end                      | `damagePhotos[]` (URLs)                    | **TRUSTED** arbitrary URLs (owner's own report; not fetched server-side)        | `src/app/api/rentals/[id]/end/route.ts:37`                                                |
| POST /api/services/bookings                     | `hours`, `proposedDate`, `paymentMethodId` | Price = listing.rate × hours server-side; provider-gated at accept              | `services/service-booking-quote.ts`                                                       |
| POST /api/services/listings                     | `communityId`                              | **VALIDATED** against caller's membership                                       | `src/app/api/services/listings/route.ts:99-104`                                           |
| GET /api/services/bookings                      | (role query)                               | List returns full row incl. counterparty PM id + Stripe ids (leak)              | `src/dal/service-booking.dal.ts:784,825`                                                  |
| POST /api/reviews                               | `rating`, `rentalId`/`serviceBookingId`    | reviewee/role/window/completion derived server-side                             | `reviews/services/blind-review-service.ts:47-70,300-312`                                  |
| POST /api/disputes                              | `reasonCode`,`description`                 | role/window/limits/one-active derived+validated; no amounts accepted            | `disputes/services/dispute-creation-service.ts:158-210`                                   |
| POST /api/disputes/[id]/evidence                | file/text                                  | Party+status+deadline+limit checked; blob URL server-generated                  | `src/app/api/disputes/[id]/evidence/route.ts:47-166`                                      |
| PATCH /api/users/me/visibility                  | `communityId`,`isVisible`                  | primary-hide blocked; **communityId NOT scoped to network/membership**          | `src/dal/community.dal.ts:1074-1128,986-1001`                                             |
| PATCH /api/services/providers/[userId]          | `bio`                                      | self-only (path==session)                                                       | `src/app/api/services/providers/[userId]/route.ts`                                        |
| PATCH /api/profile, POST /api/onboarding        | `profileImageUrl`                          | url()-validated string, stored, own-user only (arbitrary https allowed)         | `src/features/users/lib/profile.schema.ts:19`                                             |
| POST /api/push/subscribe                        | web `endpoint` URL                         | **TRUSTED** — server POSTs to it via web-push (blind SSRF, self-scoped)         | `src/features/notifications/lib/validators.ts:18-25`                                      |
| POST /api/push/subscribe                        | native `token`,`platform`                  | Expo token format validated; DELETE ownership-checked                           | `validators.ts:34-39`; `src/app/api/push/subscribe/route.ts:161`                          |
| POST /api/auth/accept-legal-documents           | tos/privacy booleans                       | server resolves CURRENT versions; client cannot claim a version                 | `src/features/auth/services/auth-service.ts:227-278`                                      |
| POST /api/stripe/create-account-link / -session | (none)                                     | return/refresh URLs server-built from env, not body                             | `src/app/api/stripe/create-account-link/route.ts:41-61`                                   |

## `src/proxy.ts` behaviour by path prefix

| Path                                                                         | No session                                          | With a session                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| paths containing "." (r:121-123), `/_next`, `/.well-known`, image extensions | skipped                                             | skipped (every handler checked self-authenticates)                                                                                                                                                                                                     |
| `/api/auth*`, `/api/profile*` (r:39,189-192)                                 | passed through                                      | passed through, **no status gate**                                                                                                                                                                                                                     |
| `/api/garage`, `/api/listings`, `/api/rentals`, `/api/messages`              | **401 JSON** (r:71-79, 304-309)                     | status rules below                                                                                                                                                                                                                                     |
| every other `/api/*` (admin, stripe, services, disputes, cron, …)            | passed; handler authenticates                       | status rules below                                                                                                                                                                                                                                     |
| status rules for any path not skipped                                        | —                                                   | `emailVerified=false` → 307 /verify-email (r:234-240); `pending_verification` → 307 /signup/google/callback (r:246-255); `email_verified` / `incomplete_profile` → API allowed (r:260-284); **active, inactive and suspended all allowed** (r:298-299) |
| `/admin/dashboard`                                                           | redirect /login unless admin (r:205-215)            | same                                                                                                                                                                                                                                                   |
| `/dashboard`, `/onboarding`, `/community-select`, `/join-code`               | redirect /login                                     | status redirects                                                                                                                                                                                                                                       |
| E2E (r:194-202)                                                              | NODE_ENV≠prod && E2E_TEST=1 → protected routes pass |                                                                                                                                                                                                                                                        |
| error path (r:310-318)                                                       | protected → 401/redirect; others → next()           |                                                                                                                                                                                                                                                        |

## Server pages and layouts that read data directly

- `/dashboard/listings/[id]`: owner, or browseable status + R5. ✓
- `/dashboard/listings/[id]/edit`: **no owner, status or R5 check.** Renders any listing plus its rejectionReason (SEC-23). ✗
- `/dashboard/listings/[id]/rent`: not-own + status + R5. ✓ (The API lacks these checks; SEC-10.)
- `/dashboard/(rentals)/rental/[id]`: `RentalDetailsServer` party check (rental-details-server.tsx:35). ✓ It passes counterparty email, phone and pickup address to the client (PRIV-01).
- `/dashboard/(rentals)/(flow)/rentals/[direction]/[status]`: DAL scoped to userId. ✓
- `/dashboard/services/bookings/[id]`: party check. ✓ But `serializeBooking` spreads the full row (PM id, Stripe ids, both emails) into client props (PRIV-04). ✗
- `/dashboard/services/(flow)/[direction]/[status]`: hydrates the full `findBy*ForDashboard` rows, including PM id and email (PRIV-04). ✗
- `/dashboard/services/listings/[id]`, `/book`, `/edit`, `/create`; `/dashboard/services/providers/[userId]`; `/dashboard/services`: provider or visibility checks present. ✓
- `/dashboard/needs/[id]`, `/edit`, `/new`; `/dashboard/disputes/[id]` (party or admin; data comes through the API); `/dashboard/mailbox`, `/explore`, `/profile/*`, `/payments/*`, `/listings/rentals`, `/listings/services`: scoped to the caller. ✓
- `/(auth)/signup/email/callback` and `/signup/google/callback`: write status or profile photo on GET, for the session user only. Setting email_verified without checking emailVerified has no effect, because proxy and layout gate on `emailVerified`.
- `/admin/dashboard/*`: `requireAdmin` in the layout (admin/dashboard/layout.tsx:18) plus the proxy. ✓
- `/test-api`: leftover dev client page that calls the authenticated search API. No server data.
- `/mobile/connect-*`: static bounce pages with fixed deep links.
- Layouts:
  - `dashboard/layout.tsx:18-25` redirects by session and status; **it has no suspended check.**
  - `PayoutReadinessBannerServer` and `footer` read only the caller's own data.

**Server actions:** none. There is no `"use server"` anywhere in `src/`.

**next.config.ts:** no rewrites or redirects. Headers on `/:path*` set CSP (`script-src` includes `'unsafe-inline' 'unsafe-eval'` in production), X-Frame-Options DENY, `frame-ancestors 'none'`, HSTS preload, nosniff and Referrer-Policy. AASA and webmanifest have pinned content types. `serverExternalPackages` covers chromium, puppeteer and sharp. `vercel.json` is `{}`.

## Full route inventory (route × method)

### Auth / funnel

| Route                            | Method | Mobile | Auth        | Status | Object authz               | Validation           | Side effects                    | RL     | Notes                                                  |
| -------------------------------- | ------ | ------ | ----------- | ------ | -------------------------- | -------------------- | ------------------------------- | ------ | ------------------------------------------------------ |
| /api/auth/[...all]               | GET    | Y      | better-auth | —      | n/a                        | better-auth zod      | session, OAuth                  | BA mem | plugin `/e2e-callback` has only E2E_TEST gate (SEC-17) |
| /api/auth/[...all]               | POST   | Y      | better-auth | —      | n/a                        | better-auth zod      | sign-in/up, email               | BA mem | memory limiter is per instance                         |
| /api/auth/signup                 | POST   | Y      | none        | —      | n/a                        | emailSignupSchema    | DB user, legal, email, Meta     | —      | calls auth.api directly (SEC-04)                       |
| /api/auth/forgot-password        | POST   | Y      | none        | —      | n/a                        | forgotPasswordSchema | email                           | —      | SEC-04                                                 |
| /api/auth/resend-verification    | POST   | Y      | none        | —      | n/a                        | manual (non-empty)   | email                           | —      | SEC-04                                                 |
| /api/auth/reset-password         | POST   | Y      | none        | —      | token (BA, 24 chars)       | resetPasswordSchema  | DB password                     | —      |                                                        |
| /api/auth/accept-legal-documents | POST   | Y      | session     | —      | self                       | manual booleans      | DB legal/status, Meta           | —      | pending→email_verified; emailVerified still gates      |
| /api/auth/join-community         | POST   | Y      | session     | —      | self                       | joinCodeSchema       | DB membership/status            | —      |                                                        |
| /api/auth/select-community       | POST   | Y      | session     | —      | self; DAL rejects inactive | manual               | DB membership/visibility/status | —      |                                                        |

### Users / profile / communities

| Route                    | Method | Mobile | Auth    | Status         | Object authz                                          | Validation             | Side effects                              | RL  | Notes                                |
| ------------------------ | ------ | ------ | ------- | -------------- | ----------------------------------------------------- | ---------------------- | ----------------------------------------- | --- | ------------------------------------ |
| /api/profile             | GET    | Y      | session | —              | self                                                  | none                   | —                                         | —   | proxy skips /api/profile\*           |
| /api/profile             | PATCH  | Y      | session | —              | self                                                  | updateProfileApiSchema | DB user incl. **email**, profileImageUrl  | —   | SEC-02, SEC-11                       |
| /api/profile/upload      | POST   | Y      | session | —              | self; cleanup trusts profileImageUrl r:74-94          | manual file ≤5MB       | blob put/del, sharp                       | —   | upload; SEC-11                       |
| /api/profile/upload      | DELETE | A      | session | —              | r:151-173 prefix or current image                     | manual pathname        | blob del                                  | —   | bypassable (SEC-11)                  |
| /api/users/me            | DELETE | A      | session | P              | self                                                  | none                   | anonymize, revoke sessions, Stripe detach | —   |                                      |
| /api/users/me/visibility | GET    | A      | session | P              | self                                                  | none                   | —                                         | —   |                                      |
| /api/users/me/visibility | PATCH  | A      | session | P              | own rows, **any communityId** community.dal:1101-1122 | manual shape           | DB upsert                                 | —   | SEC-08                               |
| /api/communities         | GET    | Y      | session | P              | n/a (any network slug)                                | manual slug            | —                                         | —   | exposes community ids of any network |
| /api/onboarding          | POST   | Y      | session | P (any status) | self                                                  | onboardingSchema       | DB user, status→active                    | —   | SEC-01                               |
| /api/hoa-inquiries       | POST   | Y      | none    | —              | n/a                                                   | hoaInquirySchema       | Google Sheets, email                      | —   | public lead form; SEC-20             |

### Listings / garage (the proxy returns 401 to anonymous callers)

| Route                                            | Method | Mobile | Auth       | Status              | Object authz                                 | Validation                           | Side effects                      | RL            | Notes                                         |
| ------------------------------------------------ | ------ | ------ | ---------- | ------------------- | -------------------------------------------- | ------------------------------------ | --------------------------------- | ------------- | --------------------------------------------- |
| /api/listings                                    | POST   | Y      | session    | P+M listing-svc:188 | n/a                                          | createListingSchemaServer            | DB, admin notif, legal, need link | —             | new listing: status inactive, pending_review  |
| /api/listings/search                             | GET    | Y      | session    | P+M                 | DAL scoped to visible communities r:22,68-74 | manual                               | —                                 | —             | set can be widened (SEC-08)                   |
| /api/listings/categories                         | GET    | Y      | proxy-only | P                   | n/a                                          | none                                 | —                                 | —             | reference data                                |
| /api/listings/analyze-image                      | POST   | Y      | session    | P                   | n/a                                          | analyzeImageSchema (array unbounded) | OpenAI                            | mem 10/h/user | URLs are fetched by OpenAI, not by the server |
| /api/listings/[listingId]                        | GET    | Y      | session    | P                   | r:84-105 owner, or status+R5                 | none                                 | viewCount++                       | —             | ignores approvalStatus (SEC-10)               |
| /api/listings/[listingId]                        | POST   | A      | session    | P                   | listing-svc:86 (verifyOwnership :60-71)      | file ≤10MB + magic bytes             | blob, DB, re-review               | —             | upload                                        |
| /api/listings/[listingId]                        | PATCH  | Y      | session    | P                   | listing-svc:308                              | createListingSchemaServer            | DB                                | —             |                                               |
| /api/listings/[listingId]                        | DELETE | Y      | session    | P                   | listing-svc:347                              | none                                 | DB, blob del                      | —             | refuses delete with rentals in flight         |
| /api/listings/[listingId]/status                 | PATCH  | Y      | session    | P                   | r:61-71 owner                                | zod enum                             | DB status                         | —             | no approval check (SEC-10)                    |
| /api/listings/[listingId]/availability           | POST   | Y      | session    | P                   | r:76-83 owner                                | blockRangeSchema                     | DB                                | —             |                                               |
| /api/listings/[listingId]/availability/[blockId] | DELETE | Y      | session    | P                   | r:39-46 + WHERE both ids r:51-60             | none                                 | DB                                | —             |                                               |
| /api/listings/[listingId]/images                 | GET    | A      | session    | P                   | r:51-58 owner                                | none                                 | —                                 | —             |                                               |
| /api/listings/[listingId]/images/[imageId]       | DELETE | Y      | session    | P                   | r:22-29 + WHERE r:32-40                      | none                                 | blob del, DB                      | —             |                                               |
| /api/listings/[listingId]/images/reorder         | PUT    | Y      | session    | P                   | r:50-57 + WHERE r:86-98                      | reorderImagesSchema                  | DB                                | —             |                                               |
| /api/garage/active                               | GET    | Y      | session    | P                   | DAL WHERE ownerId=userId                     | manual casts                         | —                                 | —             |                                               |
| /api/garage/inactive                             | GET    | Y      | session    | P                   | DAL WHERE ownerId                            | manual casts                         | —                                 | —             |                                               |
| /api/garage/archived                             | GET    | Y      | session    | P                   | DAL WHERE ownerId                            | manual casts                         | —                                 | —             |                                               |
| /api/garage/pending-review                       | GET    | Y      | session    | P                   | DAL + raw WHERE ownerId r:40                 | none                                 | —                                 | —             |                                               |
| /api/garage/pending-count                        | GET    | Y      | session    | P                   | DAL WHERE ownerId                            | none                                 | —                                 | —             |                                               |
| /api/garage/categories                           | GET    | A      | proxy-only | P                   | n/a                                          | none                                 | —                                 | —             | reference data                                |

### Rentals (the proxy returns 401 to anonymous callers)

| Route                                  | Method | Mobile | Auth    | Status            | Object authz                                                     | Validation                         | Side effects                               | RL  | Notes                                |
| -------------------------------------- | ------ | ------ | ------- | ----------------- | ---------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ | --- | ------------------------------------ |
| /api/rentals                           | POST   | Y      | session | P (no visibility) | **none**: rental-quote.ts:94-95 checks no status, approval or R5 | createRentalRequestSchema          | DB, audit, email/push                      | —   | SEC-10, SEC-03                       |
| /api/rentals/preview                   | POST   | Y      | session | P                 | **none** (same quote)                                            | previewSchema                      | —                                          | —   | discloses hidden listing name/ranges |
| /api/rentals/[id]                      | GET    | Y      | session | P                 | r:118-123 party or admin                                         | none                               | —                                          | —   | counterparty PII (PRIV-01)           |
| /api/rentals/[id]/approve              | POST   | Y      | session | P                 | rental-svc:389 owner                                             | approveRequestSchema               | Stripe charge + hold, DB, email, PDF, Meta | —   | money                                |
| /api/rentals/[id]/decline              | POST   | Y      | session | P                 | r:73-81 owner                                                    | declineRequestSchema               | DB, audit, email                           | —   | no paymentStatus guard (known class) |
| /api/rentals/[id]/cancel               | POST   | Y      | session | P                 | cancel-svc:520-532 party                                         | cancelRequestSchema                | Stripe refund/transfer/release             | —   | money                                |
| /api/rentals/[id]/cancellation-preview | GET    | Y      | session | P                 | r:75-81 party                                                    | none                               | —                                          | —   |                                      |
| /api/rentals/[id]/start                | POST   | Y      | session | P                 | r:85-90 owner                                                    | startRentalSchema                  | DB, notif                                  | —   |                                      |
| /api/rentals/[id]/end                  | POST   | Y      | session | P                 | r:106-111 owner                                                  | endRentalSchema (accepts any URLs) | DB, audit, notif                           | —   |                                      |
| /api/rentals/[id]/instructions         | PATCH  | Y      | session | P                 | r:71-79 owner                                                    | zod (strings unbounded)            | DB, notif                                  | —   |                                      |
| /api/rentals/[id]/retry-deposit        | POST   | Y      | session | P                 | plc-svc:495 renter                                               | none                               | Stripe hold                                | —   | money                                |
| /api/rentals/[id]/damage-photos        | POST   | Y      | session | P                 | r:61-66 owner                                                    | manual file (no magic check)       | blob, sharp                                | —   | upload                               |
| /api/rentals/lending/active            | GET    | A      | session | P                 | rentals.dal:1685 WHERE ownerId                                   | none                               | —                                          | —   |                                      |
| /api/rentals/lending/completed         | GET    | A      | session | P                 | rentals.dal:1685                                                 | none                               | —                                          | —   |                                      |
| /api/rentals/lending/incoming          | GET    | A      | session | P                 | rentals.dal:949 / :1685                                          | status cast                        | —                                          | —   |                                      |
| /api/rentals/renting/active            | GET    | A      | session | P                 | rentals.dal:1585 WHERE renterId                                  | none                               | —                                          | —   |                                      |
| /api/rentals/renting/completed         | GET    | A      | session | P                 | rentals.dal:1585                                                 | none                               | —                                          | —   |                                      |
| /api/rentals/renting/requests          | GET    | A      | session | P                 | rentals.dal:848 WHERE renterId                                   | status cast                        | —                                          | —   |                                      |

### Services

| Route                                            | Method | Mobile | Auth    | Status            | Object authz                               | Validation                  | Side effects                      | RL  | Notes                                     |
| ------------------------------------------------ | ------ | ------ | ------- | ----------------- | ------------------------------------------ | --------------------------- | --------------------------------- | --- | ----------------------------------------- |
| /api/services/listings                           | GET    | Y      | session | P+M               | service-listing.dal:293-295 active+visible | categoryId uuid             | —                                 | —   |                                           |
| /api/services/listings                           | POST   | Y      | session | P+M r:98-104      | n/a                                        | createServiceListingSchema  | DB, audit, admin notif, need link | —   | pending_approval                          |
| /api/services/listings/my                        | GET    | Y      | session | P                 | DAL WHERE providerId                       | none                        | —                                 | —   |                                           |
| /api/services/listings/[id]                      | GET    | Y      | session | P                 | r:52-69 provider, or active+R5             | none                        | —                                 | —   |                                           |
| /api/services/listings/[id]                      | PATCH  | Y      | session | P                 | sl-svc:159-161                             | patchServiceListingSchema   | DB, audit                         | —   |                                           |
| /api/services/listings/[id]                      | DELETE | A      | session | P                 | sl-svc:415-416                             | none                        | DB                                | —   |                                           |
| /api/services/listings/[id]/deactivate           | POST   | Y      | session | P                 | sl-svc:359-360 (no status check)           | none                        | status→inactive                   | —   | SEC-10                                    |
| /api/services/listings/[id]/reactivate           | POST   | Y      | session | P                 | sl-svc:384-385 + inactive only             | none                        | status→active                     | —   | SEC-10                                    |
| /api/services/listings/[id]/photos               | POST   | Y      | session | P                 | sl-svc:241-242                             | file ≤10MB + magic bytes    | blob, DB                          | —   | upload                                    |
| /api/services/listings/[id]/photos               | PUT    | Y      | session | P                 | sl-svc:311-312 + subset check              | setPhotosSchema             | DB, blob del                      | —   |                                           |
| /api/services/providers/[userId]                 | GET    | Y      | session | P                 | r:27-50 shared visible community           | none                        | —                                 | —   |                                           |
| /api/services/providers/[userId]                 | PATCH  | A      | session | P                 | r:160-164 self                             | patchServiceProviderSchema  | DB bio                            | —   |                                           |
| /api/services/categories                         | GET    | Y      | session | P                 | n/a                                        | none                        | —                                 | —   |                                           |
| /api/services/bookings                           | GET    | Y      | session | P                 | service-booking.dal:780/:821 WHERE role    | manual role                 | —                                 | —   | full rows incl. PM id and email (PRIV-04) |
| /api/services/bookings                           | POST   | Y      | session | P (no visibility) | service-booking-quote.ts:101 status only   | createServiceBookingSchema  | DB, audit, notif                  | —   | SEC-10                                    |
| /api/services/bookings/preview                   | POST   | Y      | session | P                 | same quote                                 | previewSchema               | —                                 | —   |                                           |
| /api/services/bookings/[id]                      | GET    | Y      | session | P                 | r:287-289 party                            | none                        | —                                 | —   | response is allow-listed (P-E9-3)         |
| /api/services/bookings/[id]/accept               | POST   | Y      | session | P                 | sb-svc:276 provider                        | none                        | Stripe charge, PDF, notif         | —   | money                                     |
| /api/services/bookings/[id]/decline              | POST   | Y      | session | P                 | sb-svc:609 provider                        | declineServiceBookingSchema | DB, notif                         | —   |                                           |
| /api/services/bookings/[id]/complete             | POST   | Y      | session | P                 | sb-svc:649 provider                        | none                        | DB, payout eligible               | —   | money (payout)                            |
| /api/services/bookings/[id]/cancel               | POST   | Y      | session | P                 | booking-cancellation.ts:60-66              | cancelServiceBookingSchema  | Stripe refund/transfer            | —   | money                                     |
| /api/services/bookings/[id]/cancellation-preview | GET    | Y      | session | P                 | r:48-62 party                              | none                        | —                                 | —   |                                           |
| /api/services/bookings/[id]/payment-lifecycle    | GET    | A      | session | P                 | r:45-47 party                              | none                        | —                                 | —   | full lifecycle row to both sides          |

### Payments / Stripe

| Route                                         | Method | Mobile | Auth        | Status | Object authz                                        | Validation     | Side effects                                | RL  | Notes                         |
| --------------------------------------------- | ------ | ------ | ----------- | ------ | --------------------------------------------------- | -------------- | ------------------------------------------- | --- | ----------------------------- |
| /api/create-setup-intent (`(payments)` group) | POST   | A      | session     | P      | self customer                                       | none           | Stripe customer + SetupIntent, DB           | —   | URL has no /payments segment  |
| /api/get-payment-methods (`(payments)` group) | GET    | Y      | session     | P      | self customer                                       | none           | Stripe read                                 | —   |                               |
| /api/stripe/payment-sheet-params              | POST   | Y      | session     | P      | self                                                | none           | Stripe customer, ephemeral key, SetupIntent | —   |                               |
| /api/stripe/attach-payment-method             | POST   | A      | session     | P      | own customer (Stripe rejects PM attached elsewhere) | manual         | Stripe attach, notif                        | —   |                               |
| /api/stripe/set-default-payment-method        | POST   | Y      | session     | P      | own customer (Stripe needs attached PM)             | manual         | Stripe update, notif                        | —   |                               |
| /api/stripe/delete-payment-method             | DELETE | Y      | session     | P      | **none** r:22-32                                    | manual `?id`   | **Stripe detach, any PM**                   | —   | SEC-07                        |
| /api/stripe/create-account-link               | POST   | A      | session     | P      | self                                                | none           | Stripe account + link                       | —   | return URLs built server-side |
| /api/stripe/create-account-session            | POST   | Y      | session     | P      | self                                                | `mode` param   | Stripe account/session                      | —   |                               |
| /api/stripe/create-login-link                 | POST   | A      | session     | P      | self                                                | none           | Stripe login link                           | —   |                               |
| /api/stripe/create-customer-portal-session    | POST   | A      | session     | P      | self                                                | none           | Stripe portal                               | —   |                               |
| /api/stripe/update-onboarding-status          | POST   | Y      | session     | P      | self                                                | manual         | Stripe read, DB                             | —   |                               |
| /api/stripe/webhooks                          | POST   | N      | webhook-sig | n/a    | n/a                                                 | constructEvent | all payment state                           | —   | 400 on bad signature          |
| /api/payments/history                         | GET    | Y      | session     | P      | paymentDAL(userId), line unverified                 | querySchema    | —                                           | —   |                               |
| /api/payouts/earnings                         | GET    | Y      | session     | P      | paymentDAL(userId), line unverified                 | querySchema    | —                                           | —   |                               |

### Messages (the proxy returns 401 to anonymous callers)

| Route                                                  | Method | Mobile | Auth    | Status | Object authz                             | Validation                       | Side effects                  | RL  | Notes                      |
| ------------------------------------------------------ | ------ | ------ | ------- | ------ | ---------------------------------------- | -------------------------------- | ----------------------------- | --- | -------------------------- |
| /api/messages/conversations                            | GET    | Y      | session | P      | DAL scoped to userId                     | manual                           | —                             | —   |                            |
| /api/messages/conversations                            | POST   | Y      | session | P      | none: any recipientId (messages.dal:437) | startConversationSchema (.parse) | DB, email/push                | —   | no R5 check, no rate limit |
| /api/messages/conversations/[conversationId]           | GET    | Y      | session | P      | messages.dal:642-649 participant         | manual                           | —                             | —   |                            |
| /api/messages/conversations/[conversationId]           | DELETE | A      | session | P      | messages.dal:950 requireParticipant      | none                             | hard-deletes for both parties | —   | observation only           |
| /api/messages/conversations/[conversationId]/messages  | POST   | Y      | session | P      | messages.dal:855                         | sendMessageSchema                | DB, email/push                | —   |                            |
| /api/messages/conversations/[conversationId]/read      | POST   | Y      | session | P      | messages.dal:769                         | none                             | DB                            | —   |                            |
| /api/messages/conversations/[conversationId]/unread    | POST   | Y      | session | P      | messages.dal:803                         | none                             | DB                            | —   |                            |
| /api/messages/conversations/[conversationId]/archive   | POST   | Y      | session | P      | messages.dal:908                         | none                             | DB                            | —   |                            |
| /api/messages/conversations/[conversationId]/unarchive | POST   | Y      | session | P      | messages.dal:908 (via archive)           | none                             | DB                            | —   |                            |
| /api/messages/unread-count                             | GET    | A      | session | P      | DAL scoped                               | none                             | —                             | —   | deprecated                 |

### Notifications / push / dashboard / schedule

| Route                          | Method | Mobile | Auth    | Status | Object authz                                 | Validation                   | Side effects | RL  | Notes                |
| ------------------------------ | ------ | ------ | ------- | ------ | -------------------------------------------- | ---------------------------- | ------------ | --- | -------------------- |
| /api/notifications             | GET    | Y      | session | P      | notifications.dal:116 WHERE userId           | manual                       | —            | —   |                      |
| /api/notifications             | POST   | A      | session | P      | notifications.dal:205-208/:266-269 id+userId | **none** (raw destructure)   | DB           | —   |                      |
| /api/notifications/count       | GET    | A      | session | P      | DAL scoped                                   | none                         | —            | —   | deprecated           |
| /api/notifications/preferences | GET    | Y      | session | P      | self                                         | none                         | —            | —   |                      |
| /api/notifications/preferences | PATCH  | Y      | session | P      | self                                         | patchPreferencesBodySchema   | DB           | —   |                      |
| /api/push/subscribe            | GET    | A      | session | P      | self                                         | none                         | —            | —   |                      |
| /api/push/subscribe            | POST   | Y      | session | P      | self; reassigns known token/endpoint         | subscribeBodySchema          | DB           | —   | token must be known  |
| /api/push/subscribe            | DELETE | Y      | session | P      | r:159-166 owner                              | unsubscribeBodySchema        | DB           | —   |                      |
| /api/push/test                 | POST   | N      | session | P      | self                                         | none                         | push         | —   |                      |
| /api/dashboard/badges          | GET    | Y      | session | P      | DAL scoped                                   | none                         | —            | —   |                      |
| /api/dashboard/summary         | GET    | Y      | session | P      | helpers(userId)                              | none                         | —            | —   | projections narrowed |
| /api/schedule                  | GET    | Y      | session | P      | DAL(userId) r:127-153                        | manual YYYY-MM-DD, ≤366 days | —            | —   |                      |

### Reviews / disputes / needs

| Route                       | Method | Mobile | Auth                         | Status              | Object authz                                                                          | Validation                       | Side effects                    | RL  | Notes                           |
| --------------------------- | ------ | ------ | ---------------------------- | ------------------- | ------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------- | --- | ------------------------------- |
| /api/reviews                | POST   | Y      | session                      | P                   | submitReview participant check (line unverified)                                      | createBlindReviewSchema (.parse) | DB, notif                       | —   |                                 |
| /api/reviews                | GET    | Y      | session                      | P                   | status: blind-review-service.ts:163-167; released reviews for any booking or reviewee | manual                           | —                               | —   | no R5 check on revieweeId       |
| /api/disputes               | GET    | Y      | session (+admin branch)      | P                   | DAL user-scoped; admin sees all r:45-72                                               | manual casts                     | —                               | —   | email stripped r:64-71          |
| /api/disputes               | POST   | Y      | session                      | P                   | disp-create:157-163 / :315-321 party                                                  | createDisputeSchema              | DB, notif, payout freeze        | —   |                                 |
| /api/disputes/[id]          | GET    | Y      | session                      | P                   | r:60-92 party; admin gets full row                                                    | none                             | —                               | —   |                                 |
| /api/disputes/[id]/evidence | POST   | Y      | session                      | P                   | r:49-90 party                                                                         | manual file/text                 | blob, DB, audit                 | —   | upload                          |
| /api/disputes/[id]/state    | PATCH  | N      | session (admin-only targets) | P                   | state-machine.ts:77 only                                                              | updateStateSchema                | DB, audit, notif                | —   | no party check (known, README)  |
| /api/disputes/[id]/resolve  | POST   | N      | admin r:38-43                | P                   | n/a                                                                                   | resolveDisputeSchema             | Stripe capture/refund           | —   | money                           |
| /api/disputes/[id]/notes    | POST   | N      | admin r:31-36                | P                   | dispute exists                                                                        | createNoteSchema                 | DB, audit                       | —   |                                 |
| /api/disputes/[id]/notes    | PUT    | N      | admin                        | P                   | membership checked **after** write r:142-150                                          | updateNoteSchema                 | DB                              | —   | known (README), not re-reported |
| /api/disputes/[id]/notes    | DELETE | N      | admin                        | P                   | r:224-232 membership                                                                  | deleteNoteSchema                 | DB, audit                       | —   |                                 |
| /api/disputes/[id]/audit    | GET    | N      | admin r:25-28                | P                   | n/a                                                                                   | none                             | —                               | —   |                                 |
| /api/needs                  | GET    | A      | session                      | P+M visible         | DAL scoped; `mine` from session                                                       | manual                           | —                               | —   |                                 |
| /api/needs                  | POST   | A      | session                      | P+M needs-svc:42-47 | n/a                                                                                   | createNeedSchema                 | DB, in-app fan-out to community | —   | no rate limit                   |
| /api/needs/[id]             | GET    | A      | session                      | P                   | r:44-59 owner, admin or R5                                                            | none                             | —                               | —   |                                 |
| /api/needs/[id]             | PATCH  | A      | session                      | P                   | needs-svc:94 owner/admin                                                              | updateNeedSchema                 | DB                              | —   |                                 |
| /api/needs/[id]             | DELETE | A      | session                      | P                   | needs-svc:155 owner/admin                                                             | none                             | soft delete                     | —   |                                 |
| /api/needs/[id]/close       | POST   | A      | session                      | P                   | needs-svc:121 owner/admin                                                             | none                             | DB                              | —   |                                 |

### Admin (all Mobile=N; `admin` = `requireAdminResponse` or `isAdmin` at the top of the handler)

| Route                                                          | Method | Auth                                        | Object authz | Validation                        | Side effects                 | Notes                              |
| -------------------------------------------------------------- | ------ | ------------------------------------------- | ------------ | --------------------------------- | ---------------------------- | ---------------------------------- |
| /api/admin/activity                                            | GET    | admin                                       | n/a          | none                              | —                            | user emails                        |
| /api/admin/activity/stats                                      | GET    | admin                                       | n/a          | none                              | —                            |                                    |
| /api/admin/badges                                              | GET    | admin                                       | n/a          | none                              | —                            |                                    |
| /api/admin/metrics                                             | GET    | admin                                       | n/a          | none                              | —                            |                                    |
| /api/admin/networks                                            | GET    | admin                                       | n/a          | none                              | —                            |                                    |
| /api/admin/communities                                         | GET    | admin                                       | n/a          | manual                            | —                            |                                    |
| /api/admin/communities                                         | POST   | admin                                       | n/a          | manual typeof                     | DB                           | joinCode set here                  |
| /api/admin/communities/[id]                                    | PATCH  | admin                                       | n/a          | manual whitelist                  | DB                           |                                    |
| /api/admin/community-memberships/pending                       | GET    | admin                                       | n/a          | manual                            | —                            | residents' addresses               |
| /api/admin/community-memberships/[id]/verify                   | POST   | admin                                       | n/a          | manual                            | DB                           |                                    |
| /api/admin/community-memberships/[id]/deny                     | POST   | admin                                       | n/a          | manual (notes required)           | DB                           |                                    |
| /api/admin/disputes/stats                                      | GET    | admin                                       | n/a          | none                              | —                            |                                    |
| /api/admin/disputes/[id]/chargeback-evidence                   | POST   | admin r:22-27                               | n/a          | none                              | Stripe dispute evidence      | money                              |
| /api/admin/legal-documents/upload                              | POST   | admin                                       | n/a          | validatePDFFile, id enum          | blob, DB                     | upload                             |
| /api/admin/legal-documents/[documentId]/[version]              | DELETE | admin                                       | n/a          | id enum; `blobPathname` arbitrary | DB, blob del of any path     | admin-trusted                      |
| /api/admin/legal-documents/[documentId]/[version]/download     | GET    | **none**                                    | n/a          | id enum                           | redirect to blob             | SEC-24                             |
| /api/admin/listings/[listingId]/approve                        | POST   | admin                                       | n/a          | none                              | DB, email/notif, need notify | sets available                     |
| /api/admin/listings/[listingId]/reject                         | POST   | admin                                       | n/a          | rejectionReasonSchema             | DB, email                    | leaves `status` untouched (SEC-10) |
| /api/admin/listings/review/pending                             | GET    | admin                                       | n/a          | manual                            | —                            |                                    |
| /api/admin/listings/review/history                             | GET    | admin                                       | n/a          | manual                            | —                            |                                    |
| /api/admin/services/listings/[id]/approve                      | POST   | admin                                       | n/a          | approveServiceListingSchema       | DB, notif                    |                                    |
| /api/admin/services/listings/[id]/reject                       | POST   | admin                                       | n/a          | rejectServiceListingSchema        | DB, notif                    | provider can undo (SEC-10)         |
| /api/admin/services/listings/review/history                    | GET    | admin                                       | n/a          | manual                            | —                            |                                    |
| /api/admin/services/payment-metrics                            | GET    | admin                                       | n/a          | manual                            | —                            |                                    |
| /api/admin/payments/lifecycle                                  | GET    | admin                                       | n/a          | manual casts                      | —                            |                                    |
| /api/admin/payments/lifecycle/[rentalId]                       | GET    | admin                                       | n/a          | none                              | —                            |                                    |
| /api/admin/payments/lifecycle/[rentalId]/release-deposit       | POST   | admin                                       | n/a          | none                              | Stripe cancel hold           | money                              |
| /api/admin/payments/lifecycle/[rentalId]/reset-payout-status   | POST   | admin                                       | n/a          | manual                            | re-arms payout               | money                              |
| /api/admin/payments/lifecycle/[rentalId]/reset-transfer-status | POST   | admin                                       | n/a          | manual                            | re-arms transfer             | money                              |
| /api/admin/payments/metrics                                    | GET    | admin                                       | n/a          | manual                            | —                            |                                    |
| /api/admin/payments/cron-history                               | GET    | admin                                       | n/a          | manual                            | —                            |                                    |
| /api/admin/rentals/[id]/no-show                                | POST   | admin                                       | n/a          | noShowSchema                      | refunds/payout               | money                              |
| /api/admin/users                                               | GET    | admin                                       | n/a          | manual casts                      | —                            | user PII                           |
| /api/admin/users/[userId]                                      | GET    | admin                                       | n/a          | none                              | —                            | user PII                           |
| /api/admin/users/[userId]                                      | PATCH  | admin; superadmin only to elevate r:105-116 | n/a          | manual (no enum check)            | DB, audit                    | no session revoke; SEC-06          |
| /api/admin/users/[userId]                                      | DELETE | superadmin r:175-181                        | n/a          | none                              | hard delete (cascade)        |                                    |
| /api/admin/users/bulk-actions                                  | POST   | admin                                       | n/a          | manual (≤100 ids)                 | status updates, email/push   | SEC-06                             |

### Cron (GET; Auth=cron; Mobile=N; no body)

| Route                                     | Side effects                                 |
| ----------------------------------------- | -------------------------------------------- |
| /api/cron/check-push-receipts             | Expo receipts, token deactivation            |
| /api/cron/cleanup-cron-history            | DB delete                                    |
| /api/cron/cleanup-notifications           | DB delete (>90 days)                         |
| /api/cron/detect-stale-charge-claims      | ops alert                                    |
| /api/cron/detect-stale-processing         | detection/alert (service unverified)         |
| /api/cron/detect-stale-service-processing | detection, ops alert                         |
| /api/cron/expire-pending-bookings         | cancels pending requests/bookings            |
| /api/cron/monitor-deposit-expiry          | deposit expiry handling (service unverified) |
| /api/cron/process-payouts                 | Stripe transfers (money)                     |
| /api/cron/process-service-payouts         | Stripe transfers (money)                     |
| /api/cron/release-reviews                 | DB, aggregates, notif                        |
| /api/cron/rental-reminders                | notifications                                |
| /api/cron/schedule-deposit-holds          | Stripe holds (money)                         |

### Internal / test

| Route                                    | Method | Auth                               | Validation                         | Side effects            | Notes                 |
| ---------------------------------------- | ------ | ---------------------------------- | ---------------------------------- | ----------------------- | --------------------- |
| /api/internal/generate-rental-agreement  | POST   | internal r:24-38                   | bodySchema uuid; requires approved | puppeteer PDF, blob, DB | template escapes HTML |
| /api/internal/generate-service-agreement | POST   | internal r:25-38                   | bodySchema uuid; requires accepted | puppeteer PDF, blob, DB |                       |
| /api/test/create-need                    | POST   | test (NODE_ENV≠prod && E2E_TEST=1) | manual                             | DB                      | accepted risk         |
| /api/test/delete-need                    | POST   | test                               | manual                             | DB                      |                       |
| /api/test/last-email                     | GET    | test                               | manual                             | —                       |                       |
| /api/test/reset-user                     | POST   | test                               | manual                             | DB                      |                       |
| /api/test/set-stripe-connect-state       | POST   | test                               | manual                             | DB                      |                       |

**Total rows: 191.** No route file has an unintended export: `MAX_EVIDENCE_ITEMS` and type exports are not handler methods.
