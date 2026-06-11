# Meta Pixel + Conversions API

End-to-end Meta tracking for Hoador. Browser events go through Meta Pixel
(`fbq`), server events through the Conversions API (CAPI). The Purchase event
is server-only, sent from the rental approval flow at the moment the renter is
actually charged.

## Environment variables

| Variable                    | Where  | Purpose                                                                     |
| --------------------------- | ------ | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_META_PIXEL_ID` | Client | Pixel id used by the browser `fbq` install. Safe to expose.                 |
| `META_PIXEL_ID`             | Server | Pixel id used in the CAPI request URL. Same value as the public id.         |
| `META_ACCESS_TOKEN`         | Server | CAPI access token. Generate in Events Manager → Settings → Conversions API. |
| `META_TEST_EVENT_CODE`      | Server | Optional. Routes CAPI events to the Test Events panel. Leave unset in prod. |

If `NEXT_PUBLIC_META_PIXEL_ID` is unset, the pixel renders nothing. If
`META_PIXEL_ID` or `META_ACCESS_TOKEN` is unset, `sendMetaEvent()` no-ops with a
warn log.

## Files

| File                                              | Role                                                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/analytics/meta.ts`                       | Browser tracker (`trackPageView`, `trackViewContent`, `trackSearch`, `trackCompleteRegistration`, `trackInitiateCheckout`, `trackRentalRequested`). SSR-safe no-op when `fbq` is missing. |
| `src/lib/integrations/meta/meta-capi.ts`          | Server CAPI client (`sendMetaEvent`, `sendMetaPurchase`, `hashMetaField`). Retries 5xx with backoff, never throws.                                                                        |
| `src/components/analytics/meta-pixel.tsx`         | Mounts the base `fbq` script via `next/script` once and fires `PageView` on initial load + every App Router pathname change (query-string-only changes are ignored).                      |
| `src/components/analytics/track-view-content.tsx` | Tiny client wrapper used inside server components to fire `ViewContent` once per content id.                                                                                              |

## Event coverage

| Event                      | Surface | Trigger                                                                             | File                                                                  |
| -------------------------- | ------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `PageView`                 | Browser | App Router navigation (pathname change only).                                       | `meta-pixel.tsx`                                                      |
| `ViewContent`              | Browser | Listing detail page view (once per listing id).                                     | `app/dashboard/listings/[id]/page.tsx`                                |
| `Search`                   | Browser | Committed search query in the URL changes.                                          | `features/listings/components/explore-page/explore-page-filters.tsx`  |
| `CompleteRegistration`     | Browser | Email/password signup mutation succeeds.                                            | `features/auth/hooks/use-auth-mutations.ts`                           |
| `InitiateCheckout`         | Browser | Mount of the rent flow page (once per visit).                                       | `features/rentals/components/rent-flow/rent-listing-page-content.tsx` |
| `RentalRequested` (custom) | Browser | Successful rental request creation (no charge yet — not a Purchase).                | `features/rentals/components/rent-flow/rent-listing-page-content.tsx` |
| `Purchase`                 | CAPI    | Owner approves the request and the renter's card is charged. `event_id = rentalId`. | `features/rentals/services/rental-service.ts`                         |

## Why Purchase is server-only

Money moves when the **owner approves** the rental request — which can happen
hours or days after the renter submits it (or never, if declined/expired). At
that moment the renter has no browser session, so there is no browser Purchase
to pair with, and no dedup is needed. The approval flow sends the CAPI event
via `after()` (post-response), with `event_id = rental id` guarding against
double-sends on approval retries. The renter-side submission is tracked as the
custom `RentalRequested` event instead, which can be used as a mid-funnel
custom conversion in Ads Manager.

## PII handling

`hashMetaField()` SHA-256-hashes email / phone / first name / last name after
trimming, lower-casing, and (for phone) stripping non-digits. `client_ip_address`
and `client_user_agent` are sent in the clear, per Meta's spec. External id
(our user id) is hashed too. Logs only carry `event_name`, `event_id`, status,
and attempt — never PII.

## Logs

- `Meta Event Sent` — `{ event_name, event_id, attempt }`
- `Meta Event Failed` — `{ event_name, event_id, status, attempt, error/response }`

## Verification checklist

Use **Meta Events Manager → Test Events** for live validation.

1. Open Events Manager → your pixel → **Test Events** tab. Copy the test event
   code shown (e.g. `TEST12345`). To make server CAPI events (e.g. Purchase)
   visible in the test panel, set `META_TEST_EVENT_CODE` to that code in your
   env — `sendMetaEvent` reads it automatically. **Unset it in production** so
   real events aren't diverted to the test panel.
2. In a browser, install the
   [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
   Chrome extension.
3. Walk the flows:
   - [ ] **PageView** — load any page; Pixel Helper should show `PageView` with the
         correct pixel id. Test Events panel should mirror it.
   - [ ] **ViewContent** — open a listing detail page
         (`/dashboard/listings/<id>`). Expect `ViewContent` with `content_ids`,
         `content_name`, `content_type=product`.
   - [ ] **Search** — type into the explore search box and wait for the URL to
         update. Expect `Search` with `search_string`.
   - [ ] **CompleteRegistration** — sign up with a fresh email. Expect
         `CompleteRegistration` to fire once on success (not on login).
   - [ ] **InitiateCheckout** — open
         `/dashboard/listings/<id>/rent`. Expect a single `InitiateCheckout` with
         `value` (listing daily rate) and `currency=USD`.
   - [ ] **RentalRequested** — complete the rent flow; expect the custom
         `RentalRequested` event with `value`, `currency`, and `content_ids`.
   - [ ] **Purchase (server)** — as the listing owner, approve the rental
         request (test card). Expect a `Purchase` row in the Test Events panel
         with `event_id` equal to the rental id, and a `Meta Event Sent` log
         line. No browser Purchase should ever appear.
4. Idempotency check: re-running an approval (payment retry) must not produce a
   second counted Purchase — same `event_id`, so Meta drops the duplicate.

## Ad attribution: what makes events count for Facebook Ads

The Pixel + CAPI events above only become useful to ad campaigns once Meta can
match them back to an ad click. That match runs on:

- **`_fbc` cookie** — Facebook ad-click ID, set when a user lands via an ad
  with `?fbclid=…`. This is the strongest signal and the only one that works
  for iOS users with the pixel cookies blocked.
- **`_fbp` cookie** — pixel browser ID, set by `fbq()` on first visit.
- **Hashed PII** (`em`/`ph`/`fn`/`ln`/`external_id`) — fuzzy fallback.

The hoador funnel makes this non-trivial because the canonical `Purchase`
event fires in the OWNER's session at approval time, hours-to-days after the
RENTER's ad click. So the renter's attribution context has to be persisted at
request creation and replayed at approval.

### Where attribution lives

- **`fbclid` → `_fbc` capture** — handled in [src/proxy.ts](../src/proxy.ts).
  When a request lands with `?fbclid=…` and no `_fbc` cookie, the proxy sets
  `_fbc=fb.1.<unix_ms>.<fbclid>` with a 90-day TTL. Format is strict — any
  variation is silently dropped by Meta.
- **Per-request capture for rentals** — [src/features/rentals/hooks/use-rental-mutations.ts](../src/features/rentals/hooks/use-rental-mutations.ts)
  reads `_fbp` / `_fbc` from `document.cookie` via `readMetaBrowserCookies()`
  (in [src/lib/analytics/meta.ts](../src/lib/analytics/meta.ts)) at submit
  time and includes them in the POST body. IP / user-agent come from request
  headers in [src/app/api/rentals/route.ts](../src/app/api/rentals/route.ts).
- **Persisted on `rental_requests.attribution_context`** (JSONB) — see
  [src/db/schemas/rentals.schema.ts](../src/db/schemas/rentals.schema.ts).
  Read back at approval via `rentalDAL.getAttributionContext(rentalRequestId)`
  in [src/dal/rentals.dal.ts](../src/dal/rentals.dal.ts).
- **Replayed at approval** — `RentalService.approveRentalRequest` in
  [src/features/rentals/services/rental-service.ts](../src/features/rentals/services/rental-service.ts)
  forwards `fbp`/`fbc`/`ip`/`userAgent` from the stored row into
  `sendMetaPurchase` so Meta sees the RENTER's attribution, not the owner's.
- **`CompleteRegistration` dedup** — both surfaces use `event_id = userId`.
  Email path: server fires in [src/app/api/auth/signup/route.ts](../src/app/api/auth/signup/route.ts);
  browser fires in [src/features/auth/hooks/use-auth-mutations.ts](../src/features/auth/hooks/use-auth-mutations.ts).
  Google path: server fires in
  [src/app/api/auth/accept-legal-documents/route.ts](../src/app/api/auth/accept-legal-documents/route.ts)
  only when the user's status transitions `pending_verification → email_verified`
  (existing users re-accepting updated docs are excluded). Browser mirrors the
  same gate via the `isNewSignup` flag the API returns.

### Campaign optimization target

`CompleteRegistration` — the funnel is too long for `Purchase` to fall inside
Meta's 7-day click window. `Purchase` still ships because Meta uses it as a
**truth signal** to learn which kinds of signups eventually rent, even when
not the optimization target. Without it, ad spend skews toward sign-up-and-bounce.

### One-time Meta-side setup (before launching ads)

1. **Domain verification** — Business Settings → Brand Safety → Domains → add
   `hoador.com`, verify via DNS TXT. Required for iOS attribution.
2. **Pixel ↔ ad account link** — Events Manager → pixel → Settings → Assign
   Assets → ad account. Without this, ads can't optimize on these events.
3. **Aggregated Event Measurement priority** — Events Manager → AEM → ordered
   list. iOS users only get attribution on the top-ranked event that fired:
   1. `CompleteRegistration` (primary optimization target)
   2. `RentalRequested`
   3. `InitiateCheckout`
   4. `Purchase`
   5. `ViewContent`
   6. `Search`
   7. `PageView`
4. **Privacy policy** — upload a new version via the legal-documents admin UI
   disclosing Meta Pixel + Conversions API + hashed PII transmission.
   Required by Meta TOS and CCPA.
5. **Custom audiences worth standing up early**:
   - "Signed up in last 30d, no rental request" → retargeting nudge.
   - "RentalRequested in 14d, no Purchase" → either nudge the renter or seed
     a different listing recommendation.
   - "Purchase in last 90d" → exclude from acquisition; seed Lookalike.

## Adding new events

1. Add a typed helper to `src/lib/analytics/meta.ts` (browser) or call
   `sendMetaEvent` directly from a server flow.
2. If the same conversion can be emitted from both browser and server, share an
   `event_id` (e.g. the booking id) so Meta dedupes — and document the key
   here. Prefer a single surface when only one side witnesses the conversion.
3. Verify in the Test Events panel before shipping.
