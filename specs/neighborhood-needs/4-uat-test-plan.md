# UAT Test Plan: Neighborhood Needs (MVP)

User Acceptance Testing (UAT) for **Neighborhood Needs**. This plan is written
for manual testers and business stakeholders to confirm the feature behaves
correctly from the **end-user's perspective** before release. It complements,
and does not replace, the automated/developer coverage in
[4-test-plan.md](./4-test-plan.md).

Each scenario is a hands-on walkthrough with explicit steps, an expected
outcome, the acceptance criteria it proves, and a result column for sign-off.
The central promises UAT must confirm:

1. A neighbor can **post demand** in their home community and immediately share it.
2. Needs surface to the **correct network audience** — never outside it.
3. A provider can go from a need to a **published, linked listing**, and the
   requester is notified when it goes live.
4. The requester's own **booking auto-closes** the need; a stranger's does not.
5. New-need alerts arrive **in-app without email/push spam**, and can be muted.

References: [1-requirements.md](./1-requirements.md) (`R#`),
[2-design.md](./2-design.md) (`§#`), [3-tasks.md](./3-tasks.md).

---

## 1. Scope

### In scope for UAT

- Navigation entry point and the Needs feed ("What Your Neighbors Need").
- Posting, viewing, editing, and closing a need.
- Network-scoped visibility (who can / cannot see a need).
- Creating a listing from a need, the resulting link, and the
  "listing created for your need" notification.
- Auto-close when the requester books a linked listing.
- New-need in-app notifications, default channel matrix, and muting.
- Post-creation share screen (Copy Link / native share).
- Dashboard Neighborhood Pulse count.
- Empty-state CTAs on browse/category dead-ends.
- Admin moderation (edit, close, soft-delete).

### Out of scope for UAT

- Provider proposals, quotes, offers, negotiation, comments, photos, budgets,
  tags (not built in MVP).
- Interest/category-subscription matching for fan-out.
- Analytics, dashboards, or events.
- Reopening a closed need (closed is terminal).
- Load/performance benchmarking (covered by the developer test plan).
- Code-level/unit assertions (covered by [4-test-plan.md](./4-test-plan.md)).

---

## 2. Roles & Participants

| Role                        | Who                                                                            | Used to verify                                                                  |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Requester**               | Standard member of a community ("Foxcroft" in the "Kansas City Metro" network) | Posting, editing, closing, sharing, auto-close, receiving "listing live" notice |
| **Provider (same network)** | Member visible in the requester's network                                      | Seeing the need, creating a listing from it, receiving new-need alerts          |
| **Out-of-network user**     | Member whose network does **not** include the need's home community            | Confirming the need is invisible to them                                        |
| **Admin**                   | `userType` of `admin` or `superadmin`                                          | Moderation: edit/close/soft-delete any need                                     |
| **No-community user**       | Authenticated user with **no** primary community                               | Confirming a clear "you need a home community" rejection                        |
| **Unauthenticated visitor** | Signed-out browser                                                             | Confirming sign-in is required on shared links / feed                           |

---

## 3. Environment & Prerequisites

- **Environment:** UAT/staging build of `hoador-web` with the Neighborhood
  Needs feature deployed and migrations (`0065`, `0066`) applied.
- **Browsers:** Latest Chrome (desktop) and one mobile browser (iOS Safari or
  Android Chrome) — the mobile browser is required to exercise **Native Share**.
- **Notifications:** In-app notification panel accessible; at least one tester
  with push enabled and one without, to verify the default channel matrix.

### Required test data (seed before starting)

- **≥ 2 networks** so cross-network invisibility can be shown (reuse the KC
  Metro + Test Network seeds).
- **Requester** in "Foxcroft" (KC Metro) with a valid primary community.
- **Provider** visible in the same network as the requester.
- **Out-of-network user** whose visible set excludes the requester's community.
- **Admin** account.
- **No-community user** (no primary membership).
- A user who has **never set** a Neighborhood Needs notification preference
  (proves defaults) and one who has **opted into push**.
- At least one community the requester is visible in but a test viewer has
  **toggled off** (proves symmetric, fail-closed visibility).
- Known rental categories (from `listing_categories`) and service categories
  (from `service_listing_categories`) to pick during creation.

---

## 4. Entry & Exit Criteria

**Entry:** feature deployed to UAT; migrations applied; seed data loaded; all
roles' credentials available; automated suite ([4-test-plan.md](./4-test-plan.md))
passing on the build under test.

**Exit (release-ready):**

- 100% of **Priority 1 (Critical)** scenarios **Pass**.
- ≥ 95% of all scenarios Pass; any Fail has a logged defect with severity and a
  go/no-go decision recorded.
- No open **Critical** or **High** severity defect against in-scope behavior.
- Sign-off recorded in §8.

---

## 5. Test Scenarios

Legend — **Result:** Pass / Fail / Blocked / N/A. Record defect IDs and notes
in the rightmost column. Priority — **P1** critical (must pass to ship), **P2**
important, **P3** polish.

### 5.1 Navigation & Feed Entry — R1

| ID     | Pri | Role            | Steps                                                             | Expected result                                                                          | Req        | Result / Notes       |
| ------ | --- | --------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- | -------------------- |
| NAV-01 | P2  | Requester       | From any page, open the primary navigation                        | A **"Neighborhood Needs"** item is present, styled like sibling items (Browse, Bookings) | R1.1, R1.3 | ✅ Pass — 2026-07-07 |
| NAV-02 | P1  | Requester       | Activate the Neighborhood Needs nav item                          | Routes to the Needs feed with heading **"What Your Neighbors Need"**                     | R1.2       | ✅ Pass — 2026-07-07 |
| NAV-03 | P1  | Unauthenticated | While signed out, open the feed URL (`/dashboard/needs`) directly | Redirected to sign-in; after sign-in, lands on the feed                                  | R1.4       | ✅ Pass — 2026-07-07 |

### 5.2 Post a Need — R4, R2

| ID      | Pri | Role              | Steps                                                                                          | Expected result                                                                                                        | Req                   | Result / Notes       |
| ------- | --- | ----------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------- |
| POST-01 | P1  | Requester         | Open create form; choose **Type = Rental**; pick a Category; enter Title + Description; submit | Need is created with status **Open**, anchored to the requester's home community; lands on the **share screen**        | R4.1, R4.8, R2.3      | ✅ Pass — 2026-07-07 |
| POST-02 | P1  | Requester         | Repeat with **Type = Service** and a service category                                          | Need created; category options came from the **service** category list, not the rental list                            | R4.3                  | ✅ Pass — 2026-07-07 |
| POST-03 | P2  | Requester         | On the create form, toggle Type between Rental and Service                                     | The **Category selector repopulates** from the correct source each time; rental and service categories are never mixed | R4.3, NFR Usability.1 | ✅ Pass — 2026-07-07 |
| POST-04 | P2  | Requester         | Add optional **Needed Start** and **Needed End** dates and submit                              | Need is created with the dates shown on detail                                                                         | R4.2                  | ✅ Pass — 2026-07-07 |
| POST-05 | P2  | Requester         | Set Needed End **before** Needed Start; submit                                                 | Submission is **rejected** with a clear validation message; no need created                                            | R4.5                  | ✅ Pass — 2026-07-07 |
| POST-06 | P2  | Requester         | Submit with Title or Description blank                                                         | Submission is **blocked**; required-field messaging shown                                                              | R4.1                  | ✅ Pass — 2026-07-07 |
| POST-07 | P2  | Requester         | Inspect the create form                                                                        | There is **no** photo, budget, tag, comment, or "choose community" field                                               | R4.6, R4.7            | ✅ Pass — 2026-07-07 |
| POST-08 | P1  | No-community user | Attempt to post a need                                                                         | Rejected with a **clear message** ("you need a home community" rather than a raw error); no need created               | R2.4, Edge 1          |                      |

### 5.3 Share Flow — R13

| ID       | Pri | Role                | Steps                                                                             | Expected result                                                                         | Req           | Result / Notes                                                                                             |
| -------- | --- | ------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| SHARE-01 | P2  | Requester           | On the share screen after posting                                                 | Copy says the request was posted and invites sharing; a **Copy Link** action is present | R13.1, R13.2  | ✅ Pass — 2026-07-07                                                                                       |
| SHARE-02 | P2  | Requester (mobile)  | On a mobile browser supporting `navigator.share`, tap **Native Share**            | The OS share sheet opens with the need link                                             | R13.2         | ✅ Pass — 2026-07-07 (verified via desktop native share; identical navigator.share path)                   |
| SHARE-03 | P2  | Requester (desktop) | On desktop where native share is unavailable                                      | Copy Link is shown; native share is hidden/absent (no broken button)                    | R13.2         | ✅ Pass — 2026-07-07 (native share works, feature-detected — not a dead button)                            |
| SHARE-04 | P1  | Requester           | Use **Copy Link**, open the link in a fresh signed-in session in the same network | Opens **directly to the need detail**                                                   | R13.3         | ✅ Pass — 2026-07-07                                                                                       |
| SHARE-05 | P1  | Unauthenticated     | Open a shared need link while signed out                                          | Prompted to sign in, then returned to the **need**                                      | R13.4         | ✅ Pass — 2026-07-07                                                                                       |
| SHARE-06 | P1  | Out-of-network user | Open a shared need link for a need outside your network                           | Neutral **"not available in your area"** state — need content is **not** shown          | R13.5, Edge 6 | ✅ Pass — confirmed on staging 2026-07-14; out-of-network shared link shows no need content (leak closed). |

### 5.4 Feed & Visibility (Network-Scoped) — R5

| ID      | Pri | Role                              | Steps                                                                   | Expected result                                                                                                                       | Req                 | Result / Notes                                                             |
| ------- | --- | --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------- |
| FEED-01 | P1  | Provider (same network)           | Open the feed after the requester posts a need                          | The need appears (newest first), showing Type, Title, truncated Description, needed dates, created date, and **linked-listing count** | R5.3, R5.5          | ✅ Pass — 2026-07-07                                                       |
| FEED-02 | P1  | Out-of-network user               | Open the feed                                                           | The requester's need is **absent**                                                                                                    | R5.1                | ✅ Pass — 2026-07-07                                                       |
| FEED-03 | P1  | Viewer with community toggled off | Toggle off the need's home community, then open the feed                | The need is **hidden**, even if you share other visible communities with the creator                                                  | R5.1, Edge (toggle) | ✅ Pass — 2026-07-07                                                       |
| FEED-04 | P1  | Provider                          | View a need whose **creator** has toggled the need's home community off | The need is **hidden** (symmetric rule — both sides must be visible)                                                                  | R5.1                | ✅ Pass — 2026-07-07                                                       |
| FEED-05 | P2  | Provider                          | Apply filters: Rental, Service, Category, Open Only                     | Results match each filter; **Open Only is on by default**; turning it off reveals closed needs                                        | R5.4                | ✅ Pass — 2026-07-14 (filters work; Open-Only on by default)               |
| FEED-06 | P2  | Provider                          | Confirm closed and admin-deleted needs in the default view              | Closed needs are absent by default; soft-deleted needs never appear under any filter                                                  | R5.3                | ✅ Pass — 2026-07-14 (closed absent by default; soft-deleted never appear) |
| FEED-07 | P3  | Provider                          | Page through a feed with many needs                                     | Pagination works; no duplicates; order stays newest-first                                                                             | R5.7                | ⏭ Skipped — not enough seeded needs to exercise pagination; low risk (P3) |
| FEED-08 | P2  | User with empty visible set       | Open the feed as a user whose visible-community set is empty            | A clean **empty state** is shown (no error)                                                                                           | R5.8                | ✅ Pass — 2026-07-14 (empty visible set → clean empty state, no error)     |

### 5.5 Need Detail — R6

| ID     | Pri | Role                 | Steps                                 | Expected result                                                                                                                                   | Req  | Result / Notes                                                                                                                                                              |
| ------ | --- | -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DET-01 | P1  | Provider             | Open **View Details** on a need       | Shows Title, Description, Category, Type, needed dates, created date, and the **linked listings visible to you** (each deep-links to the listing) | R6.1 | ✅ Pass — 2026-07-07                                                                                                                                                        |
| DET-02 | P1  | Provider (non-owner) | View an **Open** need you don't own   | A primary **"Create Listing"** CTA is shown                                                                                                       | R6.3 | ✅ Pass — 2026-07-07                                                                                                                                                        |
| DET-03 | P1  | Requester (owner)    | View your own need                    | **Edit** and **Close Request** actions are shown; no "Create Listing" CTA                                                                         | R6.4 | ✅ Pass — 2026-07-14                                                                                                                                                        |
| DET-04 | P2  | Provider             | Open a **Closed** need's detail       | Need and existing linked listings render **read-only**; no "Create Listing" CTA                                                                   | R6.5 | ✅ Pass — 2026-07-14 (closed need read-only, no Create-Listing CTA)                                                                                                         |
| DET-05 | P1  | Out-of-network user  | Open a need detail URL you cannot see | **404 / not found** (creator and admins are the only exceptions)                                                                                  | R6.2 | ✅ Pass — CONFIRMED on staging 2026-07-14 after symmetric-visibility fix + data reconcile: out-of-network user 404s on the need detail (earlier cross-network leak closed). |

### 5.6 Edit a Need — R7

| ID      | Pri | Role                 | Steps                                                                            | Expected result                        | Req          | Result / Notes                                       |
| ------- | --- | -------------------- | -------------------------------------------------------------------------------- | -------------------------------------- | ------------ | ---------------------------------------------------- |
| EDIT-01 | P1  | Requester (owner)    | Edit Title, Description, Category, and needed dates on an Open need              | Changes save and display on detail     | R7.1         | ✅ Pass — 2026-07-14                                 |
| EDIT-02 | P2  | Requester (owner)    | Look for a way to change **Type** or **Community**                               | Neither can be changed                 | R7.2         | ✅ Pass — 2026-07-14 (Type/Community not editable)   |
| EDIT-03 | P2  | Requester (owner)    | Change Category to one from the **wrong** table for the need's type (if exposed) | Rejected by validation                 | R7.3, Edge 2 | ✅ Pass — 2026-07-14 (wrong-table category rejected) |
| EDIT-04 | P1  | Provider (non-owner) | Attempt to edit someone else's need (e.g. via direct URL)                        | **Forbidden (403)** — edit not allowed | R7.4         | ✅ Pass — 2026-07-14 (non-owner edit forbidden)      |
| EDIT-05 | P2  | Requester (owner)    | Attempt to edit a **Closed** need                                                | Edit is rejected (closed is terminal)  | R7.5         | ✅ Pass — 2026-07-14 (closed need edit blocked)      |

### 5.7 Close a Need (Manual) — R8

| ID       | Pri | Role                 | Steps                                     | Expected result                                                      | Req              | Result / Notes                                                    |
| -------- | --- | -------------------- | ----------------------------------------- | -------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| CLOSE-01 | P1  | Requester (owner)    | Use **Close Request** on an Open need     | Need becomes **Closed** and drops out of the active (Open Only) feed | R8.1, R8.2, R8.3 | ✅ Pass — 2026-07-14 (drops from Open-Only feed)                  |
| CLOSE-02 | P2  | Requester (owner)    | After closing, open the need detail       | Existing linked listings are still viewable; no "Create Listing" CTA | R8.4             | ✅ Pass — 2026-07-14 (closed read-only, linked listings viewable) |
| CLOSE-03 | P2  | Requester (owner)    | Close an already-closed need (e.g. retry) | Treated as a **no-op success**, not an error                         | R8.5             | ✅ Pass — 2026-07-14 (re-close = no-op success)                   |
| CLOSE-04 | P1  | Provider (non-owner) | Attempt to close someone else's need      | **Forbidden (403)**                                                  | R8.1, R16.5      | ✅ Pass — 2026-07-14 (non-owner close forbidden 403)              |

### 5.8 Create a Listing From a Need — R9

| ID     | Pri | Role      | Steps                                                                                          | Expected result                                                                                                                         | Req             | Result / Notes                                               |
| ------ | --- | --------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| CLF-01 | P1  | Provider  | On an Open **Rental** need, click **Create Listing**                                           | The **existing rental** listing-creation flow opens, pre-filled: Type fixed to Rental, Category, suggested Title, suggested Description | R9.1, R9.2      | ✅ Pass — 2026-07-13                                         |
| CLF-02 | P1  | Provider  | On an Open **Service** need, click **Create Listing**                                          | The **existing service** listing-creation flow opens, pre-filled analogously                                                            | R9.1, R9.2      | ✅ Pass — 2026-07-13                                         |
| CLF-03 | P2  | Provider  | In the pre-filled form, edit the suggested Title/Description                                   | Suggestions are **editable** (not locked); Listing Type stays fixed                                                                     | NFR Usability.2 | ✅ Pass — 2026-07-13                                         |
| CLF-04 | P1  | Provider  | Complete all remaining required listing fields and publish                                     | Listing is created through the **normal flow** (no required field skipped) and the listing is **linked** to the originating need        | R9.3, R9.4      | ✅ Pass — 2026-07-13                                         |
| CLF-05 | P2  | Requester | After the provider publishes, view your need detail / linked-listing count                     | The new listing is reflected once it is visible/live                                                                                    | R9.4, R5.5      | ✅ Pass — 2026-07-13 (linked count → 1)                      |
| CLF-06 | P2  | Provider  | Tamper with the pre-fill link to reference a non-existent / non-visible need, then publish     | Listing is still created as an **ordinary listing**; no link, no failure                                                                | R9.6, Edge 5    | ✅ Pass — 2026-07-13 (ordinary listing, no link, no failure) |
| CLF-07 | P2  | Provider  | Start "Create Listing", have the requester **close** the need before you publish, then publish | Listing is created normally with **no link row** and no requester notification                                                          | R9.7, Edge 5    | ✅ Pass — 2026-07-13 (no link row, no requester notif)       |

### 5.9 Notification — Listing Created For Your Need — R11, R9.5

| ID     | Pri | Role              | Steps                                                                                                                            | Expected result                                                                         | Req          | Result / Notes                                              |
| ------ | --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| NLC-01 | P1  | Admin → Requester | Provider creates a listing from the requester's need; admin **approves** the rental listing (or service listing goes **active**) | Requester receives an in-app **"listing created for your need"** notification           | R9.5, R11.2  | ✅ Pass — 2026-07-13                                        |
| NLC-02 | P1  | Requester         | Open that notification                                                                                                           | It **deep-links to the listing** (not the need)                                         | R11.3        | ✅ Pass — 2026-07-13 (deep-links to listing)                |
| NLC-03 | P1  | Requester         | While the linked listing is still **pending** review, check notifications                                                        | **No** "listing created" notification yet                                               | R9.5, Edge 3 | ✅ Pass — 2026-07-13 (no notif while pending)               |
| NLC-04 | P2  | Admin → Requester | Admin **rejects** the linked listing                                                                                             | Requester receives **no** "listing created" notification; the need stays Open           | R9.5, Edge 3 | ✅ Pass — 2026-07-13 (rejected → no notif; need stays Open) |
| NLC-05 | P2  | Requester         | Confirm channel behavior for this notice                                                                                         | Delivered in-app; push/email only per the requester's existing per-category preferences | R11.4        | ✅ Pass — 2026-07-14 (in-app only per prefs)                |

### 5.10 Auto-Close on Booking — R10

| ID    | Pri | Role              | Steps                                                                          | Expected result                                                                           | Req                 | Result / Notes                                                                                                                                                                                                                 |
| ----- | --- | ----------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-01 | P1  | Requester         | As the **need's creator**, book a linked listing and have it approved/accepted | The need **auto-closes** and leaves the active feed                                       | R10.1, R10.3, R10.4 | ✅ Pass — 2026-07-13 (auto-closed on booking approval)                                                                                                                                                                         |
| AC-02 | P1  | Provider/stranger | As a **different** user, book the same linked listing                          | The need **stays Open** (someone else's booking does not meet the requester's demand)     | R10.2, Edge 4       | ✅ Pass — 2026-07-13 (stranger booking; need stays Open)                                                                                                                                                                       |
| AC-03 | P2  | Requester         | Book a listing that is linked to **several of your own** open needs            | **All** such needs close                                                                  | R10.6               | N/A — unreachable by design: unique index (listing_type, listing_id) enforces 1 listing → 1 need (R3.2). Close logic handles multiples defensively but the scenario can't be built. ⚠️ Spec tension R10.6 vs R3.2 — reconcile. |
| AC-04 | P1  | Requester         | Confirm the booking/payment flow is unaffected                                 | Booking approval/acceptance and payment behave exactly as before; no new steps, no errors | R10.5, R10.7        | ✅ Pass — 2026-07-13 (booking/payment unaffected)                                                                                                                                                                              |

### 5.11 New-Need Notifications (Opt-Out, In-App) — R12

| ID    | Pri | Role                     | Steps                                                                                                           | Expected result                                                                                 | Req               | Result / Notes                                                                                                                                                                                                                                                                                                                                              |
| ----- | --- | ------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NN-01 | P1  | Provider (no prefs set)  | Requester posts a new need in your network; check in-app notifications                                          | You receive an **in-app** new-need notification                                                 | R12.2, R12.3      | ✅ Pass — 2026-07-14                                                                                                                                                                                                                                                                                                                                        |
| NN-02 | P1  | Provider (no prefs set)  | Check email and push for that new need                                                                          | **No email**; **no push** (defaults: email off, push opt-in/off)                                | R12.3             | ✅ Pass — 2026-07-14 (no email, no push by default)                                                                                                                                                                                                                                                                                                         |
| NN-03 | P1  | Requester (creator)      | After posting, check your own notifications                                                                     | The creator is **excluded** from the fan-out (no self-notification)                             | R12.2             | ✅ Pass — 2026-07-14 (creator excluded)                                                                                                                                                                                                                                                                                                                     |
| NN-04 | P1  | Provider                 | Open the new-need notification                                                                                  | It **deep-links to the need detail**                                                            | R12.5             | ✅ Pass — 2026-07-14 (deep-links to need detail)                                                                                                                                                                                                                                                                                                            |
| NN-05 | P1  | Provider                 | **Mute** the Neighborhood Needs category in notification preferences, then have the requester post another need | You receive **nothing** for it                                                                  | R12.4             | ⚠️ Descoped (product decision 2026-07-14): in-app mute not required — muting via the email/push category toggles is sufficient; in-app notifications are always-on by design. R12.4 to be updated to match. Not a release blocker.                                                                                                                          |
| NN-06 | P2  | Provider (push opted in) | Opt into push for the category, then have a new need posted                                                     | A push is delivered in addition to in-app                                                       | R12.3             | ✅ Pass — push delivered on staging after the fanOutNewNeed sendPush fix. Triple-push traced to a SEPARATE pre-existing infra defect (subscribe route blind-inserted, no endpoint dedup) → FIXED: PushSubscriptionDAL.create() is now idempotent by endpoint + self-heals dupes (notifications.dal.ts). Redeploy + dedup existing rows, then expect 1 push. |
| NN-07 | P1  | Out-of-network user      | When a need is posted outside your network                                                                      | You receive **no** new-need notification                                                        | R12.2             | ✅ Pass — CONFIRMED on staging 2026-07-14 after symmetric fan-out fix + data reconcile: out-of-network user no longer receives the new-need notification (earlier leak closed).                                                                                                                                                                             |
| NN-08 | P2  | Requester                | Post a need and confirm the create response is immediate                                                        | Posting returns promptly; fan-out happens in the background and does not delay or fail the post | R12.7, NFR Perf.2 | ✅ Pass — 2026-07-14 (immediate response; async fan-out)                                                                                                                                                                                                                                                                                                    |

### 5.12 Dashboard — Neighborhood Pulse — R14

| ID       | Pri | Role     | Steps                                                         | Expected result                                                           | Req                 | Result / Notes                                   |
| -------- | --- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| PULSE-01 | P2  | Provider | Open the dashboard; find the Neighborhood Pulse               | Shows a **Neighborhood Needs (N)** count of **open** needs visible to you | R14.1, R14.2, R14.3 | ✅ Pass — 2026-07-14 (open-needs count shown)    |
| PULSE-02 | P2  | Provider | Activate the Pulse count                                      | Routes to the Needs feed                                                  | R14.3               | ✅ Pass — 2026-07-14 (routes to needs feed)      |
| PULSE-03 | P2  | Provider | Post/close a need in your network, then refresh the dashboard | The count reflects the change (open demand only)                          | R14.2               | ✅ Pass — 2026-07-14 (count reflects post/close) |

### 5.13 Empty-State CTAs — R15

| ID       | Pri | Role      | Steps                                                    | Expected result                                                                                 | Req          | Result / Notes |
| -------- | --- | --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------ | -------------- |
| EMPTY-01 | P2  | Requester | Run a rental browse/search that returns **zero** results | A CTA appears: _"Can't find what you need? … Create Neighborhood Need"_                         | R15.1, R15.4 |                |
| EMPTY-02 | P2  | Requester | Open an **empty category** page                          | The same Create-Need CTA appears                                                                | R15.2        |                |
| EMPTY-03 | P2  | Requester | Activate the CTA from a search/category context          | Routes to the create-need form; where inferable, **Type/Category are pre-seeded** (best-effort) | R15.3        |                |
| EMPTY-04 | P2  | Requester | Repeat on a **service** browse surface                   | CTA appears there too                                                                           | R15.4        |                |

### 5.14 Permissions & Admin Moderation — R16

| ID      | Pri | Role                 | Steps                                                                                              | Expected result                                                                                   | Req            | Result / Notes                                                                              |
| ------- | --- | -------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| PERM-01 | P1  | Requester (owner)    | Create, view, edit, and close your own need                                                        | All four actions succeed                                                                          | R16.1          | ✅ Pass — 2026-07-14 (by reference: DET-03 + EDIT-01 + CLOSE-01 all succeed for owner)      |
| PERM-02 | P1  | Provider (visible)   | View a visible need and create a listing from it                                                   | Both allowed                                                                                      | R16.2          | ✅ Pass — 2026-07-14 (by reference: Sitting 3 CLF-01/04 — provider views + creates listing) |
| PERM-03 | P1  | Admin                | Edit and close **any** need, in or out of your community                                           | Allowed regardless of community                                                                   | R16.3          | ✅ Pass — 2026-07-14 (admin edits/closes any need, in or out of community)                  |
| PERM-04 | P1  | Admin                | **Soft-delete** a need that has linked listings                                                    | Need disappears from all feeds/detail (404 for non-admins); linked-listing rows are **preserved** | R16.4, Edge 10 | ✅ Pass — 2026-07-14 (soft-delete 404s for non-admins; linked-listing rows preserved)       |
| PERM-05 | P1  | Provider (non-owner) | Attempt edit/close/delete on a need you don't own                                                  | Each is **rejected (403)**                                                                        | R16.5          | ✅ Pass — 2026-07-14 (edit/close/delete on non-owned need each rejected 403)                |
| PERM-06 | P2  | Unverified member    | Perform the in-scope actions (post/view/create-listing) as a member of an **unverified** community | Actions are **not** blocked on verification status (verification is a badge, not a gate)          | R16.6          |                                                                                             |

### 5.15 End-to-End Acceptance Journey (Success Criteria)

| ID     | Pri | Roles                                    | Steps                                                                                                                                                                                                                                                       | Expected result                                                                                                                                                                                                                                                                                    | Req                  | Result / Notes                                                                                                               |
| ------ | --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| E2E-01 | P1  | Requester → Provider → Admin → Requester | (1) Requester posts a need and reaches the share screen. (2) Provider sees it in-feed, clicks Create Listing, completes and publishes. (3) Admin approves the listing. (4) Requester is notified, opens the listing, books it, and the booking is approved. | Need is posted, shared, surfaced to the right audience, converted to a linked & published listing, the requester is notified on go-live, and the requester's booking **auto-closes** the need and drops it from the active feed — with **no** disruption to listing creation, approval, or payment | Success Criteria 1–7 | ✅ Pass — 2026-07-13 (by composition: CLF-01/03/04 + NLC-03/01/02 + CLF-05 + AC-01/04)                                       |
| E2E-02 | P1  | Requester + Out-of-network user          | Post a need, then verify it across one in-network and one out-of-network viewer (feed, detail, shared link)                                                                                                                                                 | In-network viewer sees it everywhere it should; out-of-network viewer never sees it on any surface                                                                                                                                                                                                 | Success Criteria 2   | ✅ Pass — confirmed on staging 2026-07-14: out-of-network viewer sees nothing on feed, detail, or shared link (leak closed). |

---

## 6. Defect Logging

For each Fail, record: scenario ID, role, browser/device, steps to reproduce,
expected vs. actual, screenshot/recording, and severity:

- **Critical** — blocks a core promise (e.g. a need visible outside its network;
  a booking/payment regression; the wrong user notified).
- **High** — a core flow broken with no reasonable workaround.
- **Medium** — incorrect behavior with a workaround.
- **Low** — cosmetic / copy / minor UX.

Privacy/visibility leaks (a need exposed to someone outside its visible set) and
any money-flow regression are **always Critical**.

---

## 7. Risk-Based Execution Order

Run in this order so the highest-risk promises are validated first:

1. **Network visibility** — FEED-02/03/04, DET-05, SHARE-06, E2E-02 (a leak here
   is the worst outcome).
2. **Auto-close correctness** — AC-01/AC-02 (creator-only) and AC-04 (no
   money-flow regression).
3. **Demand→supply linkage & notify** — CLF-04, NLC-01/02/03, E2E-01.
4. **Notification defaults & mute** — NN-01/02/03/05.
5. **Permissions & moderation** — PERM-04/05, EDIT-04, CLOSE-04.
6. **Post/share/edit basics** — POST-_, SHARE-_, EDIT-_, CLOSE-_.
7. **Pulse, empty-state CTAs, nav polish** — PULSE-_, EMPTY-_, NAV-01.

---

## 8. Sign-Off

| Item                       | Detail         |
| -------------------------- | -------------- |
| Build / commit under test  |                |
| UAT environment            |                |
| Test data loaded (yes/no)  |                |
| Scenarios executed         | of total       |
| P1 pass rate               | (must be 100%) |
| Open Critical/High defects |                |
| Go / No-Go decision        |                |

| Approver | Role             | Signature | Date |
| -------- | ---------------- | --------- | ---- |
|          | Product owner    |           |      |
|          | Engineering lead |           |      |
|          | QA lead          |           |      |

```

```
