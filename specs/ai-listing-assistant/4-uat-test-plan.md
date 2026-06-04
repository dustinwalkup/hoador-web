# AI Listing Assistant — User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the AI Listing Assistant feature. UAT validates that the "Generate from Photos" flow works correctly from an end-user perspective on the create-listing page (`/dashboard/listings/add`) — including the entry choice modal, photo staging, AI draft generation, error recovery, and the prefilled-review experience in the standard listing form.

**Feature**: AI Listing Assistant (Generate from Photos)
**Version**: 1.0 (MVP)
**Date**: 2026
**Test Environment**: Staging
**Reference Documents**:

- Requirements: [specs/ai-listing-assistant/1-requirements.md](1-requirements.md)
- Design: [specs/ai-listing-assistant/2-design.md](2-design.md)
- Test Plan (automated): [specs/ai-listing-assistant/4-test-plan.md](4-test-plan.md)

## Test Objectives

1. Verify the AI Listing Assistant modal opens on the create-listing page and offers a clear AI-vs-manual choice.
2. Validate the photo staging UX inside the modal (guidance, add/remove, camera, generate-disabled state).
3. Confirm the explicit generation trigger sends staged photos and only runs once per draft.
4. Verify the processing experience (perceived progress, time expectation, evidence callouts).
5. Validate that successful generation dissolves the modal into a prefilled standard listing form.
6. Confirm the draft notice banner and the Safety Notes disclaimer render when AI prefilled the form.
7. Verify error recovery flows (low-confidence, unsuitable content, network, rate-limited, server).
8. Confirm staged photos carry over to the form on cancel and on "continue manually" after a failure.
9. Validate the manual entry path leaves the existing form behavior unchanged (no banner, no badges).
10. Verify mobile responsiveness across modal states (375 px+) and camera capture on mobile.
11. Confirm AI-assisted listings follow the same submission, validation, and `pending_review` approval gate as manual listings.

## Test Scenarios

### Scenario 1: Entry Choice Modal Renders on Page Load [x]

**User Story**: As a listing creator landing on the add-listing page, I want to be asked up front whether I want AI help or to fill out the form manually.

**Preconditions**:

- User is logged in, has a community, and has completed Stripe onboarding.

**Test Steps**:

1. Navigate to `/dashboard/listings/add`.
2. Observe the page on first load.

**Expected Results**:

- The standard listing form is mounted but empty behind a modal.
- The AI Listing Assistant modal is open in its **Choice** state.
- Two options are visible: **Generate from Photos** (with sparkle icon and helper copy "Upload a few photos and we'll draft your listing") and **Fill Out Manually** (with pencil icon and helper copy "Enter your listing details yourself").
- The modal is mobile-first; both buttons are reachable with one thumb at 375 px width.
- Copy never implies autonomous creation (no "AI creates your listing automatically" wording).

**Priority**: Critical
**Requirement Reference**: Req 1.1, 1.2, 1.3, 1.7

---

### Scenario 2: Choice → Fill Out Manually [x]

**User Story**: As a creator who prefers to type everything myself, I want the modal to get out of the way instantly.

**Preconditions**:

- User is on `/dashboard/listings/add` with the Choice modal visible.

**Test Steps**:

1. Click **Fill Out Manually**.
2. Verify the modal dismisses.
3. Reload the page or trigger an interaction that could re-open the modal (focus changes, scroll).
4. Complete the listing form normally and submit.

**Expected Results**:

- Modal closes immediately; no navigation occurs (URL stays at `/dashboard/listings/add`).
- The standard listing form is fully interactive.
- The modal does NOT auto-re-open during the session.
- No draft notice banner, no Safety Notes disclaimer, no "AI Suggested" badges anywhere.
- Submitted listing follows the existing manual path and lands in **Pending Review**.

**Priority**: High
**Requirement Reference**: Req 1.4, 1.6, 7.5 (negative case)

---

### Scenario 3: Choice → Generate from Photos (Instructions State) [x]

**User Story**: As a creator using AI, I want clear, plain-language guidance on what photos to take before I commit to uploading.

**Preconditions**:

- User is on `/dashboard/listings/add` with the Choice modal visible.

**Test Steps**:

1. Click **Generate from Photos**.
2. Read the guidance list and inspect the action buttons.

**Expected Results**:

- The SAME modal transitions in place to the **Instructions** state (no navigation, no second modal).
- Header reads "Add 3–5 photos of your item" with the subline "Different angles help us draft a more accurate listing."
- Guidance list shows all four photo types with the "why" framing:
  - Full photo of the item — "Show the whole item from the side — helps us recognize what it is."
  - Brand/model label close-up — "A clear shot of any brand or model label helps us identify the exact item."
  - Accessories included — "Batteries, chargers, attachments, parts — anything that comes with it."
  - Condition close-up — "Any visible wear, scuffs, or damage — so renters know what to expect."
- "Add photos" and "Take photo" (or "Camera" on mobile) buttons are visible.
- "Generate Listing Draft" button is visible but **disabled** when zero photos are staged.
- "Cancel" button is visible.

**Priority**: Critical
**Requirement Reference**: Req 1.5, 3.1, 3.2, 3.7

---

### Scenario 4: Stage Photos (Add, Remove, Replace) [x]

**User Story**: As a creator, I want to add a few photos, remove ones I don't want, and feel in control before triggering AI.

**Preconditions**:

- User is in the AI flow on the Instructions state with no photos staged.

**Test Steps**:

1. Click **Add photos** and select 3 valid JPEG images from disk.
2. Verify previews render in a 3-column grid.
3. Click the X on one preview to remove it; confirm the tile animates out.
4. Click **Add more** and add 2 more photos.
5. Try uploading a HEIC photo (if available).
6. Try uploading a very large image (>10 MB) or a non-image file (e.g., a PDF).

**Expected Results**:

- Staged photos render as previews inside the modal (in-memory only — nothing uploaded to the server yet).
- The "Generate Listing Draft" button becomes enabled as soon as ≥1 photo is staged.
- Remove (X) button is present on each tile and accessible via touch.
- While HEIC conversion or compression is in flight, a "Processing N photo(s)…" banner appears with the note "HEIC photos can take a few seconds to convert." During this time, both **Add** and **Generate** are disabled.
- Oversized or invalid files are rejected with a clear toast/error and do not appear in the preview grid.
- No background or automatic AI analysis fires during staging.

**Priority**: Critical
**Requirement Reference**: Req 3.3, 3.4, 3.6, 3.7, 4.1

---

### Scenario 5: Generation Happy Path — Processing → Prefilled Form [x]

**User Story**: As a creator, I want to click one button and have my form drafted from my photos.

**Preconditions**:

- User is in the AI flow with 3 staged photos of a recognizable item (e.g., a brand-labeled power drill, a portable cooler with capacity printed on it, or any item with a visible model label).

**Test Steps**:

1. Click **Generate Listing Draft**.
2. Observe the modal during processing.
3. Wait for generation to complete.
4. Inspect the resulting form.

**Expected Results**:

- The modal transitions in place to the **Processing** state — no navigation, no underlying-form flash.
- The processing UI shows:
  - The expectation copy "This usually takes less than 10 seconds."
  - An animated sparkle orb with a progress ring.
  - A sequence of step labels rotating through: "Analyzing photos" → "Identifying brand and model" → "Reviewing visible specifications" → "Drafting title and description" → "Preparing your listing draft."
  - Small floating chips ("Reading photos", "Spotting the brand", etc.) drift up between steps.
- Copy never references OpenAI, gpt-4o, "inference," or any technical jargon.
- Modal **cannot** be closed via Escape or overlay click during processing.
- On success:
  - Evidence callouts briefly appear (only for fields AI confidently produced) — e.g. "We identified a likely category", "We picked up the brand from your photos", "We found a visible model number", "We pulled specifications from the label". Callouts for fields AI left blank are NOT shown.
  - The modal dissolves and the standard listing form is revealed underneath, **prefilled** with AI values (no intermediate review screen).
  - Photos used for generation are attached to the form's Photos section as the listing's images.
  - The form's existing values for pricing, delivery, owner policies, etc. remain at their defaults — AI never sets pricing.

**Priority**: Critical
**Requirement Reference**: Req 4.1, 4.2, 5.1, 5.2, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1

---

### Scenario 6: Review and Edit the AI-Drafted Form [x]

**User Story**: As a creator, I want to review the AI draft in the normal form and edit anything before submitting.

**Preconditions**:

- User has just completed a successful AI generation (Scenario 5) and is now looking at the prefilled form.

**Test Steps**:

1. Scroll to the top of the form and read the **draft notice** banner.
2. Verify "AI Suggested" indicators appear next to AI-prefilled fields (Title, Description, Category, Brand, Model, Condition, Specifications, Usage Instructions, Safety Notes).
3. Locate the **Safety Notes** field and read the disclaimer adjacent to it.
4. Edit the title, change the category to a different one, and tweak the description.
5. Add pricing (daily rate, security deposit, min/max rental period).
6. Acknowledge owner policies and click **Add Listing**.

**Expected Results**:

- The Photos section is the **first** section in the form (Photos → Basic Info → Pricing → Pickup & Delivery → Additional Details → Policies & Publish).
- A persistent, non-dismissible draft notice banner is rendered above the Photos section. Copy clearly states (a) the listing is a draft generated from the user's photos, (b) AI can make mistakes, (c) the user is expected to proofread and edit every field before submitting.
- A visually distinct (warning-styled) Safety Notes disclaimer is rendered adjacent to the Safety Notes textarea — only when AI prefilled `safetyNotes` and/or `instructions`. The disclaimer is not collapsed behind "show more" and is not dismissible.
- "AI Suggested" badges are minimal and do not make the form feel AI-centric.
- All prefilled fields are fully editable. Edits stick.
- The form runs existing client + server validation on submit; the listing is created with `approvalStatus = pending_review` (same path as a manual listing).
- The redirect goes to `/dashboard/garage` and the listing appears under the **Pending Review** tab.

**Priority**: Critical
**Requirement Reference**: Req 2.1, 2.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 10.1, 10.2, 10.3

---

### Scenario 7: Cancel from AI Flow (Photos Preserved, No Banner) [x]

**User Story**: As a creator who started the AI flow but changed my mind, I want my photos to carry over so I don't have to re-upload.

**Preconditions**:

- User is in the AI flow on the Instructions state with 2 photos staged.

**Test Steps**:

1. Click **Cancel** in the modal.
2. Verify the modal dismisses.
3. Inspect the underlying standard form.
4. Verify the modal does not auto-re-open.

**Expected Results**:

- Modal closes; no navigation.
- The 2 staged photos appear in the form's Photos section.
- No draft notice banner is shown (no AI prefill occurred).
- No Safety Notes disclaimer.
- No "AI Suggested" badges.
- The form is fully manual from this point on; the AI modal does not auto-re-open during the session.

**Priority**: High
**Requirement Reference**: Req 1.6, 3.8, 9.5

---

### Scenario 8: Error — Low Confidence / Unsuitable Photos [x]

**User Story**: As a creator who uploaded photos AI can't work with, I want a clear non-technical message and a path forward.

**Preconditions**:

- User is in the AI flow with photos that are blurry, low-confidence, or off-topic (e.g., a screenshot, a map, a landscape).

**Test Steps**:

1. Stage 2–3 unsuitable photos.
2. Click **Generate Listing Draft**.
3. Observe the modal after the call resolves.
4. Verify the recovery options.
5. Remove one staged photo from the error view; add a different one via **Add more photos**; click **Generate again**.

**Expected Results**:

- The modal stays open and transitions to the **Error** state in place (no error on the underlying form).
- For **low_confidence**: title reads "We couldn't confidently identify this item"; description suggests adding a clearer brand/model label or whole-item shot.
- For **unsuitable_content**: title reads "These photos don't look like a listable item"; description suggests removing any photos that aren't of the item.
- Photos are shown inline in the error view with X buttons so the user can remove the offending ones without leaving the error state.
- Action buttons offered: **Add more photos**, **Generate again** (disabled if no photos remain), **Continue manually**.
- Copy never references OpenAI, gpt-4o, "inference," HTTP status codes, or any technical error.
- A failed attempt does NOT count as the one-per-draft successful generation — the user can retry after fixing photos.

**Priority**: High
**Requirement Reference**: Req 4.4, 9.1, 9.2, 9.3, 9.4

---

### Scenario 9: Error — Network / Server / Rate Limited [x]

**User Story**: As a creator hitting infrastructure issues, I want graceful, plain-English error handling.

**Preconditions**:

- User is in the AI flow with photos staged.

**Test Steps**:

1. **Network**: enable offline mode in DevTools, click **Generate Listing Draft**.
2. **Server (5xx)**: with the QA endpoint stub configured to return 500, click **Generate Listing Draft**.
3. **Rate limited (429)**: trigger 10 successful generations within an hour, then attempt an 11th.
4. For each case, observe the modal and the recovery buttons.
5. From the network/server error, click **Try again** after restoring connectivity / clearing the stub.
6. From the rate-limited error, click **Continue manually**.

**Expected Results**:

- **Network**: title "We couldn't reach the drafting service"; description "Check your connection and try again. Your photos are still here."; buttons: **Try again**, **Continue manually**.
- **Server**: title "Something went wrong drafting your listing"; description nudges to try again or continue manually; buttons: **Try again**, **Continue manually**.
- **Rate limited**: title "You've hit today's drafting limit"; description states the user can still create the listing manually with photos carried over; **only** **Continue manually** is offered (no Try again).
- Inline photo tiles are NOT shown in the network/server/rate-limited errors (those aren't photo problems).
- Continue manually dismisses the modal and reveals the underlying form with staged photos preserved and no AI prefill.

**Priority**: High
**Requirement Reference**: Req 4.5, 9.1, 9.2, 9.4, 9.5

---

### Scenario 10: One Generation Per Draft (No Regeneration) [x]

**User Story**: As the business, I want AI processing to happen only once per draft so cost stays predictable.

**Preconditions**:

- User has just completed a successful AI generation and is reviewing the prefilled form.

**Test Steps**:

1. Note that no "Regenerate" or "Try AI again" affordance exists in the prefilled form.
2. Add a new photo, remove an existing photo, and reorder photos in the Photos section.
3. Observe whether any AI re-analysis is triggered.
4. Refresh the page (this counts as a new draft).

**Expected Results**:

- There is no in-form button to re-run AI on the existing draft.
- Adding, removing, or reordering photos after generation does NOT trigger any AI call.
- No field "auto-updates" in the background during editing.
- On a hard refresh, the user lands back on the Choice modal — but the previous draft state is not preserved (this is a fresh draft).

**Priority**: High
**Requirement Reference**: Req 4.3, 8.1, 8.2, 8.3, 8.4

---

### Scenario 11: Photos Persist as Listing Images After Submission [x]

**User Story**: As a creator, I want the photos I uploaded for AI to become the listing's photos that buyers see.

**Preconditions**:

- User has just completed AI generation and is in the prefilled form.

**Test Steps**:

1. Verify the staged photos appear in the Photos section with the "Main" badge on the first.
2. Optionally remove one and add a new one.
3. Complete the form (pricing, policies) and submit.
4. Navigate to the listing detail page (from `/dashboard/garage` → Pending Review → listing).

**Expected Results**:

- Photos shown in the modal carry through as the listing's images.
- Standard photo controls (drag-to-reorder, remove, add) work in the form as in any manual listing.
- The submitted listing displays the chosen photos in the carousel on the detail page (post admin approval).
- Images are uploaded via the existing Vercel Blob pipeline on submit (not during AI analysis).

**Priority**: High
**Requirement Reference**: Req 8.1, 8.2, 10.1, 10.5

---

### Scenario 12: Mobile Responsiveness Across Modal States []

**User Story**: As a mobile user, I want every step of the AI flow to be usable on my phone.

**Preconditions**:

- User is on a mobile device or mobile viewport (375 px, 390 px, 414 px widths). iOS Safari and Android Chrome both tested.

**Test Steps**:

1. Open `/dashboard/listings/add` on mobile.
2. Walk through Choice → Instructions → Processing → (success or error) → Form.
3. On the Instructions state, tap **Take photo / Camera** — verify the device camera opens (not the photo library).
4. Add photos from camera and from gallery.
5. Trigger an error scenario; verify error copy renders cleanly on small screens.
6. After a successful generation, scroll through the prefilled form on mobile.

**Expected Results**:

- All modal states render within the viewport with no horizontal scroll.
- Buttons are reachable with one thumb; tap targets are adequately sized.
- **Camera capture** launches the device camera on tap (via `capture="environment"`); gallery picker is separate.
- Processing animation does not flicker on iOS Safari; "This usually takes less than 10 seconds" copy does not truncate.
- Photo preview grid is 3 columns and remains usable.
- Error copy wraps cleanly; action buttons stack vertically on small screens.
- Prefilled form respects existing mobile responsiveness (Photos section first, sections stack single-column < 640 px).
- The draft notice banner and Safety Notes disclaimer are readable and not truncated.

**Priority**: Critical
**Requirement Reference**: Req 1.7, 3.5, 6.6, 11.2

---

### Scenario 13: AI Output Quality Sanity Check (Manual Judgment) []

**User Story**: As a stakeholder, I want a quick read on whether the AI draft is actually useful, not just technically functional.

**Preconditions**:

- User has staging accounts and a small set of test items photographed in advance (ideally: one branded power tool, one kitchen/household item, one outdoor/recreation item, one baby/kids item, and one "miscellaneous").

**Test Steps**:

1. For each test item, walk the AI flow with 3–5 photos including a brand/model close-up where applicable.
2. Inspect the prefilled values.

**Expected Results**:

- **Title** reads as a natural product name a person would type.
- **Description** is grounded in what's visible in the photos — no fabricated features.
- **Category** resolves to a sensible active category (or remains blank if uncertain — blank is preferred over a wrong guess).
- **Brand** and **Model** are populated only when a label was actually visible. Blank is acceptable and preferred over a guess.
- **Condition** is one of `new | good | fair | poor` — never "excellent" or a free-form value.
- **Specifications** include 1–4 short, sensible keys (e.g. "capacity", "power", "seating", "age range") appropriate to the item type.
- **Instructions** and **Safety Notes** are plausible starting drafts that read as editable suggestions (the Safety Notes disclaimer reinforces this).
- **Pricing** is NOT populated (daily rate, deposit, etc. remain at form defaults).
- Evidence callouts feel earned — they aren't shown for fields AI didn't populate.

**Priority**: Medium
**Requirement Reference**: Req 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.5, 11.3, 11.4

---

### Scenario 14: AI vs. Manual Listings Follow Identical Submission Path []

**User Story**: As an admin, I want AI-assisted listings to enter the same review queue as manual listings.

**Preconditions**:

- A QA admin account is available.

**Test Steps**:

1. Submit one AI-assisted listing and one fully manual listing.
2. Sign in as the QA admin and review the admin listings queue.

**Expected Results**:

- Both listings appear in the **Pending Review** queue.
- Both pass through the same Zod validation on submit.
- There is no auto-publish, auto-approval, or special routing for AI-assisted listings.
- No new database table, column, or status was introduced — AI-assistedness is not persisted to the listing record.
- (Optional) Telemetry events distinguish AI-assisted vs. manual submissions (see Performance/Instrumentation note below).

**Priority**: High
**Requirement Reference**: Req 10.2, 10.3, 10.4, 12.3

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Test environment is set up and accessible.
- [ ] Test user accounts created:
  - Listing creator with completed Stripe onboarding and community membership.
  - QA admin account for verifying the approval queue.
- [ ] Photo fixtures prepared:
  - 3–5 clear photos of a branded power tool (full item, label close-up, condition shot).
  - 3 photos for a non-tool item (cooler, baby item, kitchen item, etc.) to exercise dynamic categories.
  - A blurry / low-quality photo set (for low_confidence).
  - A clearly non-listable photo set (screenshot, map, landscape — for unsuitable_content).
  - HEIC photo (to verify conversion banner).
  - Oversized / non-image file (to verify rejection).
- [ ] Network throttling / offline mode available in DevTools.
- [ ] Ability to stub `/api/listings/analyze-image` responses to force 500 and 429 in staging.
- [ ] Mobile devices available (iOS Safari and Android Chrome).

### Test Environment

- **Environment**: Staging
- **Browsers**: Chrome, Firefox, Safari (latest)
- **Devices**:
  - iOS: iPhone 12+ (Safari)
  - Android: recent Chrome
- **Database**: PostgreSQL with seed categories and the active 10-category catalog.

### Test Execution

- [ ] Execute all 14 scenarios.
- [ ] Document Pass / Fail / Blocked for each.
- [ ] Capture screenshots for any failures (especially error copy and prefilled-form indicators).
- [ ] Run Scenarios 1, 3, 5, 6, 12 on at least one iOS Safari and one Android Chrome device.
- [ ] Verify Scenarios 13 and 14 with a QA admin sign-in.
- [ ] File defects/issues in the issue tracker.
- [ ] Verify fixes and re-test failed scenarios.

### Post-Test Activities

- [ ] Verify all **Critical** scenarios passed (1, 3, 4, 5, 6, 12).
- [ ] Document any known issues or copy concerns.
- [ ] Spot-check generation cost in the OpenAI dashboard to confirm only explicit, user-triggered calls occurred.
- [ ] Sign off on feature acceptance.
- [ ] Prepare test summary report.

## Acceptance Criteria Summary

The AI Listing Assistant feature SHALL be considered accepted when:

1. The Choice modal opens on landing and offers a clear AI-vs-manual choice with non-autonomous framing.
2. Selecting Manual dismisses the modal without navigation and does not auto-re-open.
3. Selecting AI transitions the same modal to the Instructions state with the four photo-type guidance entries and the "why" framing.
4. Photo staging works for add, remove, and replace; the Generate button is disabled with zero photos; nothing is uploaded server-side during staging.
5. Generation only runs on explicit Generate Listing Draft click and only once per successful draft.
6. The Processing state shows the perceived-progress animation with the "less than 10 seconds" expectation, and ends with evidence callouts only for fields AI confidently produced.
7. Successful generation dissolves the modal into the prefilled form (no intermediate screen) with the draft notice banner, the Safety Notes disclaimer (when applicable), and minimal "AI Suggested" indicators.
8. Pricing is never populated by AI; categories resolve correctly or remain blank; condition is one of `new | good | fair | poor` or blank; brand/model are blank when not confidently identified.
9. All error states (low_confidence, unsuitable_content, network, server, rate_limited) render plain-English copy with correct recovery actions and no technical jargon.
10. Cancel and continue-manually paths preserve staged photos in the form with no banner/disclaimer.
11. AI-assisted listings submit through the same validation and `pending_review` approval path as manual listings, with no schema changes.
12. The flow is fully usable on mobile (375 px+), including device camera capture.

## Known Issues and Limitations

- **Single generation per draft**: There is no in-form regeneration affordance by design. To re-run AI, the user must refresh and start a new draft.
- **AI accuracy**: The quality of generated drafts depends on photo quality and the OpenAI gpt-4o model. Blank fields are preferred over fabricated values; reviewers should expect occasional misses (e.g., obscure brands).
- **Rate limit is per-user, in-memory**: 10 successful generations per user per hour, enforced in-memory in the current single-region deployment. Multi-instance deployments would need a shared-store migration.
- **Pricing is fully manual**: AI never suggests pricing, deposit, or rental periods. This is intentional for MVP.
- **Services flow not covered**: Only items / tools / equipment (`/dashboard/listings/add`). The services creation flow is out of scope.
- **No live OpenAI in automated CI**: Live model behavior is verified only in this UAT pass (Scenario 13) and via manual smoke after release.

_Additional issues to be filled during test execution._

## Test Sign-Off

- **Test Executor**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_
- **Business Stakeholder**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_
- **Product Owner**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_
- **Technical Lead**: \_\_\_\_\_\_\_\_\_\_ Date: \_\_\_

---

**Document Version**: 1.0
**Last Updated**: 2026-06-03
**Next Review**: After test execution
