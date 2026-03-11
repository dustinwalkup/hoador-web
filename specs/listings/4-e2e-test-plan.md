# Test Plan: Listings E2E Testing

This test plan defines how to verify the Listings feature end-to-end using Playwright against the running Next.js application and test database. It covers complete user workflows for listing creation, editing, deletion, search/explore, garage management, image handling, and authorization boundaries. Unit and integration tests for listings remain under the existing [4-test-plan.md](./4-test-plan.md).

## Requirements Traceability

Every functional requirement of the listings feature is covered by at least one E2E test case or by infrastructure verification.

| Req ID | Requirement Summary                                                                      | Test Coverage        |
| ------ | ---------------------------------------------------------------------------------------- | -------------------- |
| L1     | Create listing (auth, Stripe onboarding, community membership, form, images, legal ack)  | Tests 1, 2, 3, 4     |
| L2     | Edit listing (ownership required, pre-populated form, save updates)                      | Tests 5, 6, 7        |
| L3     | Delete listing (ownership required, no active rentals)                                   | Tests 8, 9, 10       |
| L4     | Listing status management (available/maintenance/inactive, no manual rented)             | Tests 11, 12, 13     |
| L5     | Listing detail view (image carousel, specs, pricing, owner info, rent button)            | Tests 14, 15         |
| L6     | Explore/search listings (filters, sort, pagination/infinite scroll)                      | Tests 16, 17, 18, 19 |
| L7     | Garage management (tabs: active, inactive, archived, pending-review; filter, sort)       | Tests 20, 21, 22, 23 |
| L8     | Image management (upload, reorder, delete during create/edit)                            | Tests 3, 24, 25      |
| L9     | Approval workflow (new listings get pending_review; admin vs regular user visibility)    | Tests 26, 27         |
| L10    | Authorization boundaries (unauthenticated access, non-owner edits/deletes)               | Tests 28, 29, 30     |
| L11    | Form validation (all schema rules: name, description, rates, delivery, images, policies) | Tests 2, 31, 32      |
| L12    | Stripe onboarding prerequisite                                                           | Test 33              |
| L13    | Cross-feature data integrity (create appears in garage, edit reflected in explore)       | Tests 34, 35         |

## Test Types

### E2E Tests (Playwright)

All tests in this plan are **end-to-end**: they run in a real browser (Chromium by default), drive the Next.js app via the configured `baseURL`, and assert on page content, redirects, API responses, and state transitions across the listings feature.

- **Framework:** `@playwright/test`
- **Config:** `playwright.config.ts` (baseURL `http://localhost:3001`, `E2E_TEST=1`, 1 worker)
- **Location:** `e2e/listings/*.spec.ts` (new Playwright project to be added alongside the existing `auth` project)

### Infrastructure / Guard Verification (Optional)

- **Test-only route guard:** Any new test API routes (e.g. `/api/test/reset-listings`) must return 404 when `E2E_TEST` is not set. Can be verified as a unit test or manual check.

## Test Environment

- **Database:** PostgreSQL in Docker (or CI service container); URL from `.env.test` or CI env.
- **Application:** Next.js started with `E2E_TEST=1` and `.env.test` on a dedicated port (e.g. 3001).
- **Migrations:** Applied once before tests (globalSetup or CI step).
- **Seed:** E2E seed (truncate + e2e.seed) run before tests (globalSetup or CI step). The seed must be **extended** to include listing categories, sample listings, and Stripe onboarding flags for the test users.
- **Workers:** 1 worker for the listings E2E project to avoid DB state conflicts between tests.
- **Retries:** 0 in CI; optional 1 locally to reduce flakiness from transient issues.
- **Image uploads:** In E2E mode, image uploads go to Vercel Blob (or a test blob store). A small JPEG fixture file is included in test assets for upload tests.

## Test Data Requirements

### Seeded Data (from extended E2E seed)

The existing e2e seed at `src/db/seeds/e2e.seed.ts` must be extended with the following:

**Listing categories** — 8 categories seeded with **deterministic UUIDs** matching `src/constants/listings.ts` (`STATIC_CATEGORIES`):

| Category         | UUID                                   |
| ---------------- | -------------------------------------- |
| Power Tools      | `ce4622d8-e9cf-40c2-8fbc-d99495aad651` |
| Hand Tools       | `3c0d8ccb-2545-4dcc-97d8-394540ea6eb0` |
| Gardening        | `f36e4c44-1f07-4abf-8d4c-ecc5ed0fcb90` |
| Ladders & Access | `fe211c30-81b4-46b6-94b2-6fde2aebd68f` |
| Construction     | `052899f7-17fa-4abc-a749-cee4183f4b18` |
| Cleaning         | `7f193d36-b821-498e-87e2-0eac45a78ffa` |
| Automotive       | `6b38e3ed-1b05-44c0-9e7f-645f4c029758` |
| Party Equipment  | `252eb012-ed42-495e-a0e0-b958610ec6f7` |

**Legal documents (listing-creation):**

- `SAFETY_LIABILITY_PACKAGE` (`safety_liability_package`)
- `PROHIBITED_ITEMS_AND_LISTING_CONTENT` (`prohibited_items_and_listing_content`)

These are in addition to the existing TOS/Privacy/Community docs already seeded for auth.

**Stripe onboarding flag:**

- `active@e2e.test` must have `connectOnboardingComplete: true`.
- `admin@e2e.test` must have `connectOnboardingComplete: true`.

**Second active user:**

- `active2@e2e.test` — status `active`, `connectOnboardingComplete: true`, community member, password `E2E_PASSWORD`. Used for non-owner boundary tests.

**Seeded listings:**

| Name                      | Owner              | Status        | Approval         | Category     | Daily Rate | Notes                       |
| ------------------------- | ------------------ | ------------- | ---------------- | ------------ | ---------- | --------------------------- |
| `E2E Listing Available`   | `active@e2e.test`  | `available`   | `approved`       | Power Tools  | `$25.00`   | At least 1 image, full data |
| `E2E Listing Maintenance` | `active@e2e.test`  | `maintenance` | `approved`       | Hand Tools   | `$15.00`   |                             |
| `E2E Listing Inactive`    | `active@e2e.test`  | `inactive`    | `approved`       | Gardening    | `$10.00`   |                             |
| `E2E Listing Pending`     | `active@e2e.test`  | `available`   | `pending_review` | Construction | `$20.00`   |                             |
| `E2E Listing Other Owner` | `active2@e2e.test` | `available`   | `approved`       | Cleaning     | `$30.00`   | At least 1 image            |

**No-Stripe user (optional):**

- `no-stripe@e2e.test` — status `active`, `connectOnboardingComplete: false`, community member. For Stripe prerequisite test (Test 33).

### Dynamic Data in Tests

- **Create listing tests:** Use unique listing names per run (e.g. `E2E Test Drill ${Date.now()}`) to avoid name collisions when reusing the same DB.
- **Image fixtures:** A small JPEG file at `e2e/fixtures/test-image.jpg` (a 100x100 solid-color image, under 10KB).

### Constants File

A new constants file `e2e/listings/constants.ts` should define:

```ts
export const E2E_LISTING_AVAILABLE_ID = "e2e-listing-available";
export const E2E_LISTING_MAINTENANCE_ID = "e2e-listing-maintenance";
export const E2E_LISTING_INACTIVE_ID = "e2e-listing-inactive";
export const E2E_LISTING_PENDING_ID = "e2e-listing-pending";
export const E2E_LISTING_OTHER_OWNER_ID = "e2e-listing-other-owner";
export const E2E_CATEGORY_POWER_TOOLS = "ce4622d8-e9cf-40c2-8fbc-d99495aad651";
export const E2E_USER_ACTIVE2 = "active2@e2e.test";
```

## E2E Test Cases

Each test case maps to requirements and follows the same structure as the auth E2E test plan.

---

### 1. Create listing — complete happy path

- **File:** `e2e/listings/create-listing.spec.ts`
- **Requirements:** L1, L8, L9, L11

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/add`.
3. Assert the add listing page loads (heading or form visible).
4. Fill basic information: name (unique, e.g. `E2E Test Drill ${Date.now()}`), description (50+ chars), select category "Power Tools", condition "Good".
5. Fill pricing: daily rate `$15.00`, weekly rate `$75.00`, security deposit `$50.00`.
6. Upload 1 image from `e2e/fixtures/test-image.jpg`. Assert image preview appears.
7. Configure delivery: select "Both Available", set delivery radius to `10`, delivery fee `$5.00`.
8. Fill additional details: instructions text, safety notes text, min rental 1 day, max rental 14 days.
9. Check the owner policies acknowledgment checkbox.
10. Click submit.
11. Assert success toast or redirect to listing detail / garage page.
12. Navigate to garage. Assert the new listing appears in the "Pending Review" tab (new listings get `pending_review`).

**Test data:** Unique listing name. Seeded categories, legal docs. `active@e2e.test` with Stripe onboarding complete.

---

### 2. Create listing — form validation errors (missing required fields)

- **File:** `e2e/listings/create-listing.spec.ts`
- **Requirements:** L1, L11

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/add`.
3. Attempt to submit the form without filling any fields (click submit or trigger validation).
4. Assert validation errors are displayed for: name, description, category, daily rate.
5. Assert missing image validation prevents submission.
6. Assert missing owner policies acknowledgment prevents submission.
7. Assert the form is NOT submitted (no redirect, no success toast).

---

### 3. Create listing — image upload and management during creation

- **File:** `e2e/listings/create-listing.spec.ts`
- **Requirements:** L1, L8

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/add`.
3. Upload first image from fixture. Assert image preview appears.
4. Upload second image from fixture. Assert two image previews visible.
5. Delete the first image. Assert only one image preview remains.
6. Assert minimum 1 image requirement is satisfied.

---

### 4. Create listing — delivery and setup cross-field validation

- **File:** `e2e/listings/create-listing.spec.ts`
- **Requirements:** L1, L11

**Steps and assertions:**

1. Log in as `active@e2e.test`, navigate to `/dashboard/listings/add`.
2. Select delivery mode "Delivery Only" but leave delivery radius empty or at 0.
3. Attempt submit or trigger validation. Assert error: delivery radius is required when delivery is available.
4. Select delivery mode "Pickup Only". Enable "Setup Available" checkbox.
5. Assert validation error: setup service requires delivery to be available (delivery mode cannot be `pickup_only`).
6. Switch delivery mode to "Both Available", set radius to `5`. Enable "Setup Available".
7. Assert no validation errors on delivery/setup fields.

---

### 5. Edit listing — happy path (owner edits own listing)

- **File:** `e2e/listings/edit-listing.spec.ts`
- **Requirements:** L2

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/${E2E_LISTING_AVAILABLE_ID}/edit`.
3. Assert the edit page loads with a pre-populated form.
4. Change the listing name to a new unique value.
5. Change the daily rate to `$30.00`.
6. Click save/submit.
7. Assert success toast or redirect to listing detail.
8. Navigate to the listing detail page. Assert the updated name and rate are displayed.

**Test data:** Seeded `E2E Listing Available` owned by `active@e2e.test`.

---

### 6. Edit listing — pre-populated form values match original listing

- **File:** `e2e/listings/edit-listing.spec.ts`
- **Requirements:** L2

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/${E2E_LISTING_AVAILABLE_ID}/edit`.
3. Assert name input value matches seeded listing name (`E2E Listing Available`).
4. Assert description textarea value matches seeded description.
5. Assert category select shows "Power Tools".
6. Assert daily rate input value matches `$25.00`.
7. Assert existing images are loaded and displayed.

**Test data:** Seeded listing with known values.

---

### 7. Edit listing — non-owner cannot edit

- **File:** `e2e/listings/edit-listing.spec.ts`
- **Requirements:** L2, L10

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/${E2E_LISTING_OTHER_OWNER_ID}/edit`.
3. Assert either: 404 page displayed, redirect away, or error message indicating non-owner access is denied.

**Test data:** Seeded listing owned by `active2@e2e.test`.

---

### 8. Delete listing — happy path (owner deletes own listing)

- **File:** `e2e/listings/delete-listing.spec.ts`
- **Requirements:** L3

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Create a new listing via the form (to avoid destroying seeded data). Note the listing name.
3. Navigate to the garage page. Locate the newly created listing in the "Pending Review" tab.
4. Click the delete action. Confirm the deletion dialog if present.
5. Assert the listing is removed from the garage list.
6. Navigate to the listing's detail URL. Assert 404 or "not found" page.

**Test data:** Dynamically created listing.

---

### 9. Delete listing — non-owner cannot delete (403)

- **File:** `e2e/listings/delete-listing.spec.ts`
- **Requirements:** L3, L10

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Send `DELETE` request via `page.request.delete()` to `/api/listings/${E2E_LISTING_OTHER_OWNER_ID}`.
3. Assert response status is 403 or response body contains a forbidden/unauthorized message.

**Test data:** Seeded listing owned by `active2@e2e.test`.

---

### 10. Delete listing — listing with active rental cannot be deleted

- **File:** `e2e/listings/delete-listing.spec.ts`
- **Requirements:** L3

**Steps and assertions:**

1. Requires a listing with an active rental record. Seed via test API or seed extension.
2. Log in as the owner of that listing.
3. Attempt to delete via API (`DELETE /api/listings/${listingWithActiveRentalId}`).
4. Assert response indicates failure (error about active rentals preventing deletion).

**Test data:** Seeded listing with an active rental record. **Mark as optional/deferred** if rental seed is not yet available.

---

### 11. Status management — change listing to maintenance

- **File:** `e2e/listings/status-management.spec.ts`
- **Requirements:** L4

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to the garage page. Locate `E2E Listing Available`.
3. Open the status change control (dropdown, menu, or button).
4. Change status to "Maintenance".
5. Assert the listing now shows the maintenance status badge/indicator.

**Test data:** Seeded `E2E Listing Available`.

---

### 12. Status management — change listing to inactive and verify explore visibility

- **File:** `e2e/listings/status-management.spec.ts`
- **Requirements:** L4

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Change a listing's status to "Inactive" via the garage UI or API (`PATCH /api/listings/${listingId}/status`).
3. Assert the listing appears in the "Inactive" tab of the garage.
4. Navigate to `/dashboard/explore`. Search for the listing by name.
5. Assert the listing does NOT appear in explore search results (inactive listings are hidden from search).

**Test data:** Seeded listing or dynamically created listing.

---

### 13. Status management — cannot manually set status to "rented"

- **File:** `e2e/listings/status-management.spec.ts`
- **Requirements:** L4

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Send `PATCH` to `/api/listings/${E2E_LISTING_AVAILABLE_ID}/status` with body `{ "status": "rented" }`.
3. Assert response status 400 or validation error (the schema only allows `available`, `maintenance`, `inactive`).

**Test data:** Any seeded listing owned by `active@e2e.test`.

---

### 14. Listing detail view — displays all information correctly

- **File:** `e2e/listings/listing-detail.spec.ts`
- **Requirements:** L5

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/${E2E_LISTING_AVAILABLE_ID}`.
3. Assert listing name (`E2E Listing Available`) is displayed.
4. Assert listing description is visible.
5. Assert daily rate is displayed (formatted as currency, e.g. `$25.00`).
6. Assert category name ("Power Tools") is displayed.
7. Assert condition badge is visible.
8. Assert at least one image is displayed (image carousel or gallery).
9. Assert owner information section is present.

**Test data:** Seeded `E2E Listing Available` with full data.

---

### 15. Listing detail view — owner sees edit/delete controls, non-owner sees rent button

- **File:** `e2e/listings/listing-detail.spec.ts`
- **Requirements:** L5, L10

**Steps and assertions:**

1. Log in as `active@e2e.test`. Navigate to `/dashboard/listings/${E2E_LISTING_AVAILABLE_ID}`.
2. Assert "Edit" button or link is visible.
3. Assert delete control is available (menu, button).
4. Log out. Log in as `active2@e2e.test`. Navigate to the same listing detail page.
5. Assert "Edit" button is NOT visible.
6. Assert delete control is NOT available.
7. Assert "Rent" button IS visible.

**Test data:** Seeded listing owned by `active@e2e.test`, viewed by both owner and `active2@e2e.test`.

---

### 16. Explore page — search by keyword

- **File:** `e2e/listings/explore.spec.ts`
- **Requirements:** L6

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/explore`.
3. Assert the explore page loads with listing cards visible.
4. Type a known seeded listing name (or partial, e.g. "Other Owner") into the search input.
5. Wait for debounced search to execute (~300ms).
6. Assert search results include the matching listing.
7. Clear the search. Assert all approved listings return.

**Test data:** Seeded listings with known names.

---

### 17. Explore page — filter by category

- **File:** `e2e/listings/explore.spec.ts`
- **Requirements:** L6

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/explore`.
3. Select the "Power Tools" category filter.
4. Assert only listings in the "Power Tools" category are displayed.
5. Select a different category (e.g. "Cleaning"). Assert results change to show `E2E Listing Other Owner`.
6. Remove the category filter. Assert all approved listings return.

**Test data:** Seeded listings across different categories.

---

### 18. Explore page — filter by price range

- **File:** `e2e/listings/explore.spec.ts`
- **Requirements:** L6

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/explore`.
3. Set minimum price filter to `$20` and maximum price to `$50`.
4. Assert displayed listings have daily rates within the specified range (`$25.00` and `$30.00` seeded listings).
5. Assert listings outside the range (e.g. `$10.00`, `$15.00`) are not displayed.

**Test data:** Seeded listings with varying daily rates.

---

### 19. Explore page — infinite scroll pagination

- **File:** `e2e/listings/explore.spec.ts`
- **Requirements:** L6

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/explore`.
3. Assert initial set of listings is loaded (up to page limit, default 12).
4. If there are more than 12 approved listings, scroll to the bottom of the page.
5. Assert additional listings are loaded (loading indicator appears, then more cards render).
6. Assert no duplicate listings are displayed (verify unique listing IDs/names).

**Test data:** Requires 13+ approved listings in the seed. **Mark as optional** if seed has fewer listings.

---

### 20. Garage page — active tab displays correct listings

- **File:** `e2e/listings/garage.spec.ts`
- **Requirements:** L7

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/garage`.
3. Assert the garage page loads.
4. Assert the active tab is selected by default.
5. Assert `E2E Listing Available` appears in the active tab.
6. Assert listings owned by other users do NOT appear.

**Test data:** Seeded listings owned by `active@e2e.test`.

---

### 21. Garage page — tab switching (active, inactive, pending-review)

- **File:** `e2e/listings/garage.spec.ts`
- **Requirements:** L7

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/garage`.
3. Click the "Inactive" tab. Assert `E2E Listing Inactive` is displayed.
4. Click the "Pending Review" tab. Assert `E2E Listing Pending` is displayed.
5. Click the "Active" tab again. Assert active listings are displayed.
6. Assert each tab shows only the listings appropriate for that status/approval state.

**Test data:** Seeded listings in various statuses.

---

### 22. Garage page — search/filter within tabs

- **File:** `e2e/listings/garage.spec.ts`
- **Requirements:** L7

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/garage`.
3. On the active tab, use the search input to filter by listing name.
4. Assert only matching listings are displayed.
5. Apply a category filter. Assert results update accordingly.
6. Clear filters. Assert all active listings return.

**Test data:** Multiple seeded active listings.

---

### 23. Garage page — navigate to listing detail from garage

- **File:** `e2e/listings/garage.spec.ts`
- **Requirements:** L7

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/garage`.
3. Click on a listing card or "View" link for `E2E Listing Available`.
4. Assert navigation to `/dashboard/listings/${E2E_LISTING_AVAILABLE_ID}`.
5. Assert the listing detail page loads with correct data.

**Test data:** Seeded active listing.

---

### 24. Image management — upload images during edit

- **File:** `e2e/listings/image-management.spec.ts`
- **Requirements:** L8

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to `/dashboard/listings/${E2E_LISTING_AVAILABLE_ID}/edit`.
3. Assert existing images are loaded.
4. Upload a new image from fixture via `page.setInputFiles()`. Assert it appears in the image list.
5. Save the form. Assert success.
6. Reload the edit page. Assert the new image persists.

**Test data:** Seeded listing with at least 1 existing image.

---

### 25. Image management — delete image during edit

- **File:** `e2e/listings/image-management.spec.ts`
- **Requirements:** L8

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to edit page for a listing with at least 2 images (or upload a second image first).
3. Delete one image. Assert image count decreases by 1.
4. Save the form. Assert success.
5. Reload the edit page. Assert the deleted image is gone.

**Test data:** Seeded listing with 2+ images, or upload a second image first in the test.

---

### 26. Approval workflow — new listing gets pending_review status

- **File:** `e2e/listings/approval.spec.ts`
- **Requirements:** L9

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Create a new listing via the form (complete happy path with unique name).
3. Navigate to garage. Click the "Pending Review" tab.
4. Assert the newly created listing appears in the pending review tab.
5. Navigate to `/dashboard/explore`. Search for the listing by name.
6. Assert the pending listing does NOT appear in explore search results (regular users only see approved listings).

**Test data:** Dynamically created listing.

---

### 27. Approval workflow — admin can see unapproved listings; regular user cannot

- **File:** `e2e/listings/approval.spec.ts`
- **Requirements:** L9

**Steps and assertions:**

1. Log in as `active@e2e.test` (regular user).
2. Navigate to `/dashboard/explore`. Search for `E2E Listing Pending`.
3. Assert the pending listing does NOT appear in results.
4. Log out. Log in as `admin@e2e.test`.
5. Navigate to `/dashboard/explore`. Search for `E2E Listing Pending`.
6. Assert the pending listing DOES appear in results (admin bypass for approval filtering).

**Test data:** Seeded `E2E Listing Pending` with `approvalStatus: pending_review`.

---

### 28. Authorization — unauthenticated user cannot access listing pages

- **File:** `e2e/listings/authorization.spec.ts`
- **Requirements:** L10

**Steps and assertions:**

1. Ensure no session (clean browser context).
2. Navigate to `/dashboard/listings/add`. Assert redirect to `/login`.
3. Navigate to `/dashboard/garage`. Assert redirect to `/login`.
4. Navigate to `/dashboard/explore`. Assert redirect to `/login`.
5. Navigate to `/dashboard/listings/${E2E_LISTING_AVAILABLE_ID}`. Assert redirect to `/login`.

**Test data:** None (unauthenticated).

---

### 29. Authorization — API routes require authentication

- **File:** `e2e/listings/authorization.spec.ts`
- **Requirements:** L10

**Steps and assertions:**

1. Without logging in, use `request.newContext()` (no cookies) to:
2. Send `POST` to `/api/listings` with valid body. Assert response status 401.
3. Send `PATCH` to `/api/listings/${E2E_LISTING_AVAILABLE_ID}`. Assert 401.
4. Send `DELETE` to `/api/listings/${E2E_LISTING_AVAILABLE_ID}`. Assert 401.
5. Send `PATCH` to `/api/listings/${E2E_LISTING_AVAILABLE_ID}/status`. Assert 401.

**Test data:** None (unauthenticated API requests).

---

### 30. Authorization — non-owner API operations return 403

- **File:** `e2e/listings/authorization.spec.ts`
- **Requirements:** L10

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Send `PATCH` to `/api/listings/${E2E_LISTING_OTHER_OWNER_ID}` with valid body. Assert 403.
3. Send `DELETE` to `/api/listings/${E2E_LISTING_OTHER_OWNER_ID}`. Assert 403.
4. Send `PATCH` to `/api/listings/${E2E_LISTING_OTHER_OWNER_ID}/status` with `{ "status": "inactive" }`. Assert 403.

**Test data:** Seeded listing owned by `active2@e2e.test`.

---

### 31. Form validation — name and description boundaries

- **File:** `e2e/listings/form-validation.spec.ts`
- **Requirements:** L11

**Steps and assertions:**

1. Log in, navigate to `/dashboard/listings/add`.
2. Leave name empty, trigger validation. Assert error for required name.
3. Enter 256-character name. Assert error about max length (255 max).
4. Leave description empty, trigger validation. Assert error for required description.
5. Enter 2001-character description. Assert error about max length (2000 max).
6. Enter valid name (10 chars) and description (50 chars). Assert no errors on those fields.

---

### 32. Form validation — pricing rules

- **File:** `e2e/listings/form-validation.spec.ts`
- **Requirements:** L11

**Steps and assertions:**

1. Log in, navigate to `/dashboard/listings/add`.
2. Enter daily rate of `$0.00`. Trigger validation. Assert error about minimum rate (must be > $0.01).
3. Enter daily rate of `$10.00`. Assert no error on daily rate.
4. Enter weekly rate of `$0.00`. Assert error about minimum (must be > $0.01 if provided).
5. Leave weekly rate empty. Assert no error (optional field).

---

### 33. Stripe onboarding prerequisite — garage shows onboarding prompt

- **File:** `e2e/listings/stripe-prerequisite.spec.ts`
- **Requirements:** L12

**Steps and assertions:**

1. Log in as a user WITHOUT Stripe onboarding complete (e.g. `no-stripe@e2e.test` or a user seeded with `connectOnboardingComplete: false`).
2. Navigate to `/dashboard/garage`.
3. Assert the Stripe onboarding prompt / setup component is visible.
4. Assert the normal garage tabs (active, inactive, etc.) are NOT shown or the "Add Listing" button is NOT available.

**Test data:** User without Stripe onboarding. Requires a seeded user with `connectOnboardingComplete: false`.

---

### 34. Cross-feature integrity — created listing appears in garage and explore

- **File:** `e2e/listings/data-integrity.spec.ts`
- **Requirements:** L13

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Create a new listing via the form with a unique name. Note the name.
3. Navigate to `/dashboard/garage`. Assert the listing appears in "Pending Review" tab.
4. (If admin approval test API exists) Approve the listing via test API. Otherwise, verify via admin login.
5. Navigate to `/dashboard/explore`. Search for the listing by name. Assert it appears.

**Test data:** Dynamically created listing.

---

### 35. Cross-feature integrity — edited listing reflects updated data everywhere

- **File:** `e2e/listings/data-integrity.spec.ts`
- **Requirements:** L13

**Steps and assertions:**

1. Log in as `active@e2e.test`.
2. Navigate to edit page for `E2E Listing Available`. Change the name to a unique new value.
3. Save the edit. Assert success.
4. Navigate to `/dashboard/garage`. Assert the listing shows the updated name.
5. Navigate to `/dashboard/explore`. Search for the new name. Assert the listing appears with the updated name.
6. Navigate to the listing detail page. Assert the updated name is displayed.

**Test data:** Seeded `E2E Listing Available`.

---

## Test Execution

### Local

1. Start Docker Postgres (or ensure it is running): `bun run e2e:db:up`.
2. Copy `.env.test.example` to `.env.test` and set `DATABASE_URL` and other required vars.
3. Run globalSetup (migrate, truncate, seed) which now includes listings data.
4. Start the Next.js app with `E2E_TEST=1` and `.env.test` on port 3001.
5. Run: `npx playwright test e2e/listings` (or the listings project name).
6. Optionally: `npx playwright test --ui` for UI mode.

### CI

1. Checkout; install dependencies.
2. Start PostgreSQL service container; set `DATABASE_URL`.
3. Set E2E env vars; include `BETTER_AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN` (or mock) from secrets.
4. Run migrations; run E2E seed (truncate + seed, including listings data).
5. Build app; start app on port 3001; wait for readiness.
6. Install Playwright browsers (Chromium); run `npx playwright test e2e/listings`.
7. On failure, upload `playwright-report/` and `test-results/` (traces, screenshots, video).

### Order and isolation

- Tests run in a single worker; order is determined by file and test declaration order.
- Tests that create listings use unique names to avoid conflicts.
- Destructive tests (delete, status change) should either create their own listings first or run after read-only tests.
- **Recommended test file execution order:**
  1. `authorization.spec.ts` — read-only, no session needed
  2. `listing-detail.spec.ts` — read-only against seeded data
  3. `explore.spec.ts` — read-only search/filter
  4. `garage.spec.ts` — read-only tab/filter
  5. `form-validation.spec.ts` — does not submit (validation only)
  6. `create-listing.spec.ts` — creates new listings (additive)
  7. `edit-listing.spec.ts` — modifies seeded listings
  8. `image-management.spec.ts` — modifies images
  9. `status-management.spec.ts` — modifies listing status
  10. `delete-listing.spec.ts` — removes listings
  11. `approval.spec.ts` — tests approval visibility
  12. `stripe-prerequisite.spec.ts` — different user context
  13. `data-integrity.spec.ts` — cross-feature (may create/edit)
- Database is reset and seeded once per run (globalSetup); tests do not reset between tests unless a different strategy is adopted later.

## Coverage Goals

- **Requirements:** Every requirement L1–L13 is covered by at least one test.
- **User flows:** All 7 key user flows (create, edit, delete, status, explore, garage, images) have dedicated test cases.
- **API coverage:** All listing API routes (POST, PATCH, DELETE, GET, search, status, images) are exercised through either UI flows or direct API assertions.
- **Authorization:** Every write endpoint is tested for both unauthenticated (401) and non-owner (403) access.
- **Validation:** All critical schema rules (name, description, rates, delivery cross-field, images minimum, policies acknowledgment) are tested through the form UI.
- **Regression value:** Tests verify that data flows correctly across features (create → garage, edit → explore, delete → 404), catching integration regressions that unit tests cannot.

## Edge Cases and Special Considerations

- **Image upload in E2E:** Vercel Blob uploads require a valid `BLOB_READ_WRITE_TOKEN`. In CI, use a test token or mock the blob upload. Playwright's `page.setInputFiles()` is used to upload files to `<input type="file">` elements.
- **Stripe onboarding mock:** The E2E seed sets `connectOnboardingComplete: true` directly in the database for active users. No real Stripe interaction is needed for E2E.
- **Infinite scroll detection:** Use `page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))` and wait for the next batch of listings with `waitForResponse` or `waitForSelector` for new listing cards. Mark as optional if seed has < 13 listings.
- **Category UUIDs:** The E2E seed must use the exact deterministic UUIDs from `STATIC_CATEGORIES` in `src/constants/listings.ts` so that explore page category filters reference valid IDs.
- **Legal documents for listing creation:** The seed must include `safety_liability_package` and `prohibited_items_and_listing_content` legal documents, otherwise the add listing form will not render the acknowledgment checkboxes.
- **Search debounce:** Explore search is debounced (~300ms). Tests must wait for the debounce to fire and results to update — use `page.waitForResponse('**/api/listings/search**')` or `page.waitForTimeout(500)` as a fallback.
- **Test user state mutation:** If a test changes a seeded listing (e.g. edits the name or changes status), subsequent tests may see different data. Prefer creating new listings for destructive operations, or document the expected order.
- **Admin user for approval tests:** `admin@e2e.test` must have `connectOnboardingComplete: true` and community membership for explore page access.
- **Concurrent state (tab switching):** The garage uses React Query with stale times (30s–5min). Tab switching in quick succession should not cause stale data issues in E2E because tests wait for content to render.

## Security and Isolation

- **Test-only routes:** Any new test API routes (e.g. `/api/test/reset-listings`) must return 404 when `E2E_TEST !== '1'`. Verified by deployment config (E2E_TEST not set in production) or by an optional infrastructure test.
- **Test database:** Only the test database (Docker or CI service) is used; production and staging URLs are never used in E2E.
- **Seeded data:** E2E listing data uses obviously fake names (prefixed with "E2E") and placeholder images. No real user data or real Stripe accounts.
- **Blob storage:** If using real Vercel Blob in E2E, uploaded test images should use a dedicated test prefix path (`listings/e2e-*`) and ideally be cleaned up after test runs.
- **No cross-user data leakage:** Tests verify that user A cannot see/modify user B's listings through both UI and API assertions (Tests 7, 9, 15, 30).

## References

- Listing form schema: `src/features/listings/form-schema/listing.schema.ts`
- DB schema: `src/db/schemas/listings.schema.ts`
- Static categories: `src/constants/listings.ts`
- Legal document IDs: `src/constants/legal-documents.ts`
- API routes: `src/app/api/listings/` (create, update, delete, status, search, images, categories)
- Garage API: `src/app/api/garage/` (active, inactive, archived, pending-review, pending-count, categories)
- Page routes: `src/app/dashboard/listings/` (add, [id], [id]/edit), `src/app/dashboard/garage/`, `src/app/dashboard/explore/`
- Existing E2E seed: `src/db/seeds/e2e.seed.ts`
- Existing E2E constants: `e2e/auth/constants.ts`
- Auth E2E test plan (format reference): `specs/auth/e2e-testing/4-test-plan.md`
- Playwright config: `playwright.config.ts`
