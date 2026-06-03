# AI Listing Assistant — Test Plan

## Overview

Verifies the AI Listing Assistant satisfies the requirements in `1-requirements.md` and the design in `2-design.md`. Tests are layered so subtle logic (resolution, coercion, state transitions, timers) is pinned at the unit level, integrations (route + DAL + OpenAI + rate limiter) are pinned at the integration level, and user flows are pinned end-to-end. A small manual pass covers UX feel that automation can't judge (copy, mobile camera, evidence-callout tone).

## Tooling

| Layer              | Tool                                                          | Notes                                             |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------- |
| Unit + integration | Vitest (`vitest.config.mjs`)                                  | Existing project standard                         |
| Component          | Vitest + React Testing Library                                | Co-located `.test.tsx`                            |
| API route          | Vitest with `next/server` request shims, mocked OpenAI client | Pattern reused from existing route specs          |
| E2E                | Playwright (`playwright.config.ts`, `e2e/`)                   | Existing fixtures and auth setup                  |
| Manual             | Checklist below                                               | Reviewer with mobile device, no script automation |

No new frameworks introduced.

## Coverage goals

- **100% of pure utilities and the modal reducer** — these are deterministic; full branch coverage is the right bar.
- **≥90% line coverage on the analyze route handler** — every error path and the rate-limit refund path must be exercised.
- **Behavioral coverage on UI components** — every visible state for each modal view is rendered at least once; component tests assert behavior, not markup details.
- **One E2E per state-machine "shape"** — happy AI, manual-from-choice, cancel-from-AI, 500 failure, 429 failure. No exhaustive cross-product.

We are not setting a global percentage target; the project doesn't enforce one today and a number invites gaming.

## TDD strategy by layer

This locks in the answer from the design discussion. Each task in `3-tasks.md` falls into exactly one bucket.

| Bucket                                                        | Approach                                                        | Tasks                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| **Strict TDD** (write test → red → green → refactor)          | Test cases are the contract; write them first                   | 1.2, 1.3, 1.4, 2.2, 3.3, 4.1                       |
| **Tests alongside** (scaffold tests early; iterate with code) | Mockable boundary exists but plumbing is iterative              | 2.3, 2.4, 3.1, 3.2, 8.1                            |
| **Tests after** (build, then lock behavior in)                | UI shape settles iteratively; TDD here ossifies bad assumptions | 5.1–5.5, 6.2–6.4, 7.2–7.6, 8.2, 9.1–9.3, 10.1–10.4 |
| **No test** (verification task)                               | Grep/manual confirmation                                        | 11.1–11.3                                          |

If a task fights its bucket during implementation, switch buckets and update this table — don't force the methodology.

## Test data and fixtures

Co-located under `src/features/listings/ai-listing-assistant/__fixtures__/` and `e2e/fixtures/ai-listing-assistant/`.

| Fixture                               | Purpose                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `aiDraft.full.ts`                     | Every AiDraft field populated; all 9 prefilled keys                                                               |
| `aiDraft.minimal.ts`                  | Only `name`, `description`, `categoryId` populated; brand/model/condition/specs/instructions/safetyNotes all null |
| `aiDraft.lowConfidence.ts`            | All nulls — used to test the `data: null` server path                                                             |
| `categories.fixture.ts`               | A 10-item category fixture matching `constants/listings.ts` plus one inactive category to verify it is filtered   |
| `openaiResponse.dewalt.json`          | Raw gpt-4o-shaped response matching the DeWalt example in the current prompt                                      |
| `openaiResponse.excellentLegacy.json` | Same shape but `condition: "excellent"` — verifies coercion-to-null at the route layer                            |
| `openaiResponse.unknownCategory.json` | `categoryName: "Welding Equipment"` — verifies blank `categoryId`                                                 |
| `openaiResponse.malformed.txt`        | Invalid JSON — verifies the `safeParse` fallback path                                                             |
| `images/`                             | Three small JPEGs (full item, brand/model label, condition close-up) used by E2E                                  |

## Mock and stub strategy

- **OpenAI client** — module-level mock via `vi.mock("openai", ...)`. Default mock returns `openaiResponse.dewalt.json`. Individual tests override per case.
- **`fetch` (client hook tests)** — `vi.stubGlobal("fetch", mock)` returning fixture-backed responses per status code.
- **`FileReader`** — `vi.stubGlobal("FileReader", FakeFileReader)` for hook tests; emits `dataUrl` synchronously to keep tests deterministic.
- **Timers** (`useSimulatedSteps`) — `vi.useFakeTimers()`; tests advance via `vi.advanceTimersByTimeAsync`.
- **Analyze endpoint in E2E** — Playwright `page.route("**/api/listings/analyze-image", ...)` returns fixture-driven `AiDraft` or specific status codes per scenario. We never call live OpenAI from any automated test.
- **Auth in E2E** — reuse the existing auth-setup fixture used by other listing E2E specs.
- **Rate limiter** — exposes `__resetForTests()` only under `process.env.NODE_ENV === "test"`; tests use it to isolate.

## Test cases

### A. Pure utilities and reducer (Unit, Strict TDD)

**`resolveAiDraft` — `src/services/openai/resolve-ai-draft.test.ts`** _(Task 1.2)_

| Case                       | Input                             | Expected                                                           |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| Happy path                 | DeWalt fixture + 10-cat fixture   | Full `AiDraft` with resolved Power Tools UUID, `condition: "good"` |
| Legacy "excellent"         | Excellent fixture                 | `condition: null`; everything else preserved                       |
| Unknown category           | Welding fixture                   | `categoryId: null`; everything else preserved                      |
| Inactive category          | Match against inactive cat        | `categoryId: null` (inactive filtered out of candidate list)       |
| Case-insensitive match     | `categoryName: "power tools"`     | Resolves to Power Tools UUID                                       |
| Trim whitespace            | `categoryName: "  Power Tools  "` | Resolves to Power Tools UUID                                       |
| Empty specifications       | `specifications: { power: "" }`   | Returned `specifications` is `{}`                                  |
| Brand/Model null preserved | `brand: null, model: null`        | `brand: null, model: null` (no fabrication)                        |
| Malformed input            | Raw string (not JSON-parseable)   | Returns `null`                                                     |
| Missing required fields    | `name: undefined`                 | Returns `null` (parse fails)                                       |

_Requirements: 5.3, 5.4, 5.5, 5.6_

**`aiDraftToInitialValues` / `computeAiPrefilledFields`** _(Tasks 1.3, 1.4)_

| Case                                                   | Expected                                              |
| ------------------------------------------------------ | ----------------------------------------------------- |
| Full draft → full prefill                              | All 9 keys present; `prefilledFields.size === 9`      |
| Minimal draft → minimal prefill                        | 3 keys; null fields excluded so form defaults survive |
| `aiDraft.lowConfidence` → `prefilledFields.size === 0` | Banner won't render                                   |
| Specifications `{}` → key omitted                      | Form default `{}` survives                            |
| Images always forwarded                                | Empty array preserved; non-empty preserved            |

_Requirements: 5.6, 7.2, 7.4, 7.5, 8.1_

**Rate limiter — `src/lib/api/ai-rate-limit.test.ts`** _(Task 2.2)_

| Case                                    | Expected                             |
| --------------------------------------- | ------------------------------------ |
| First 10 calls within window            | All return `{ allowed: true }`       |
| 11th call within window                 | `{ allowed: false }`                 |
| Refund + 11th call                      | `{ allowed: true }` after refund     |
| Token regeneration after 60-min advance | Window resets; 11th call now allowed |
| Two distinct users                      | Independent buckets                  |
| `__resetForTests()`                     | Clears all buckets                   |

_Requirements: 4.5_

**`useSimulatedSteps`** _(Task 3.3)_

| Case                    | Expected                                                        |
| ----------------------- | --------------------------------------------------------------- |
| Linear advancement      | Index advances at each step's `minMs` boundary                  |
| `finalize()` on step 3  | Fast-forwards to step 5, then 400 ms grace before "done" signal |
| Promise outlives script | Stays on step 5 indefinitely (no overflow)                      |
| `finalize()` on step 5  | Holds 400 ms then signals done                                  |

_Requirements: 6.1, 6.2_

**Modal reducer — `src/features/listings/components/ai-listing-assistant/modal-state.test.ts`** _(Task 4.1)_

A transition matrix test driven from the state diagram. Every cell in the matrix from `2-design.md` §Architecture is asserted. Includes:

- Choice→Manual emits closed state and `dismissed: true`
- Choice→Instructions with empty `staged`
- Instructions: `STAGE_PHOTOS` toggles ReadyToGenerate
- Instructions: `REMOVE_PHOTO` to zero → ReadyToGenerate ⇒ Instructions
- Cancel from Instructions/Error → Closed (with photos preserved in the action payload)
- ReadyToGenerate→Processing
- Processing→Closed on `GENERATE_SUCCESS`
- Processing→Error on `GENERATE_FAILURE`
- Error→Processing (`RETRY_FROM_ERROR`)
- Error→Instructions (`BACK_TO_INSTRUCTIONS`)
- Illegal action (`BEGIN_GENERATE` from Choice) → no-op
- Reducer is pure: same input → same output, no mutation

_Requirements: 1.4, 1.5, 3.6, 3.8, 4.1, 9.2_

### B. Client hooks (Unit + Integration, Tests alongside)

**`useAnalyzeListingDraft`** _(Tasks 3.1, 3.2)_

| Case                           | Expected                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Happy path                     | `fetch` called once with `imageUrls` as base64 array; `onSuccess(draft)` called                 |
| Idempotency                    | Second `generate()` after success does NOT call `fetch`; `onSuccess` re-fires with cached draft |
| HTTP 429                       | `onFailure("rate_limited")`                                                                     |
| HTTP 500                       | `onFailure("network")`                                                                          |
| HTTP 400 (non-429)             | `onFailure("server")`                                                                           |
| `data: null` from 200          | `onFailure("low_confidence")`                                                                   |
| Network error (`fetch` throws) | `onFailure("network")`                                                                          |
| FileReader rejects             | `onFailure("server")`                                                                           |
| `isPending` flips correctly    | True during request; false after settle                                                         |

_Requirements: 4.1, 4.3, 4.5, 9.1, 9.2_

### C. API route (Integration, Tests alongside)

**`/api/listings/analyze-image` route** _(Task 2.4)_

| Case                         | Setup                               | Expected                                                                                                            |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Happy path                   | OpenAI mock → DeWalt; DAL → 10 cats | `200 { success: true, data: AiDraft }` with resolved Power Tools UUID; rate-limit token consumed                    |
| Unknown category             | OpenAI → Welding                    | `200 { data: { ..., categoryId: null } }`; token consumed                                                           |
| Legacy condition             | OpenAI → excellent                  | `200 { data: { ..., condition: null } }`; token consumed                                                            |
| Malformed JSON               | OpenAI → raw text                   | `200 { data: null }`; token **refunded**                                                                            |
| OpenAI throws                | OpenAI → reject                     | `500` via `handleApiError`; token refunded                                                                          |
| Rate limited                 | 10 prior successes within window    | `429 { error: "rate_limited" }`; OpenAI not called                                                                  |
| Prompt construction          | Inspect mock invocation             | Prompt body contains all 10 active category names verbatim; condition list contains exactly `new, good, fair, poor` |
| Unauthed                     | No session                          | `401` via `requireAuthResponse`; OpenAI not called                                                                  |
| `withRequestLogging` payload | Spy on logger                       | Logs include `userId`, `photoCount`, `latencyMs`, `parseSucceeded`, `categoryResolved`, `conditionResolved`         |

_Requirements: 4.5, 5.2, 5.3, 5.4, 5.5, 9.4, 12.2_

### D. Modal sub-views (Component, Tests after)

**`ChoiceView`** _(Task 5.1)_

- Renders both options; emits `onAiSelected` / `onManualSelected` on respective clicks. _Req 1.2, 1.3_

**`InstructionsView`** _(Task 5.2)_

- Guidance copy present for all four photo types (full item, brand/model label, accessories, condition close-up) including the _why_ phrase per type.
- Generate disabled with zero staged photos; enabled at ≥1. _Req 3.7_
- File input has `accept="image/*"` and `capture` attribute. _Req 3.5_
- Add/remove/replace updates internal state and revokes object URLs on remove.
- Cancel button emits `onCancelFromAi` with the staged photos as `ImageFile[]`. _Req 3.8_

**`ProcessingView`** _(Task 5.3)_

- Renders the 5-step ticker with completed/active visual states.
- Time expectation ("usually takes less than 10 seconds") rendered. _Req 6.4_
- Evidence callouts conditional on the draft:
  - With `model: "DCD777C2"` → "We found a visible model number" rendered.
  - With `model: null` → NOT rendered.
  - With resolved category → "We identified a likely category" rendered.
  - With `categoryId: null` → NOT rendered.
- _Req 6.1, 6.2, 6.3, 6.5_

**`ErrorView`** _(Task 5.4)_

- Reason → copy + button set:
  - `low_confidence` → "Try again", "Add more photos", "Continue manually"
  - `network` → "Try again", "Continue manually"
  - `server` → "Try again", "Continue manually"
  - `rate_limited` → "Continue manually" only
- Copy never includes "OpenAI", "gpt-4o", "inference", or raw error strings. _Req 9.1_

**`AILIstingAssistantModal` composition** _(Task 5.5)_

- Walks the state machine end-to-end with a mocked `useAnalyzeListingDraft`.
- Modal cannot be closed via escape/overlay while in `processing`.

### E. Form-side primitives (Component, Tests after)

**`DraftNotice`** _(Task 6.2)_ — Copy contains (a) draft-from-photos, (b) AI can make mistakes, (c) proofread + edit. No dismiss button. _Req 7.5_

**`SafetyDisclaimer`** _(Task 6.3)_ — Warning-styled `Alert`; owner-responsibility framing present; no collapse affordance. _Req 7.6_

**`AISuggestedBadge`** _(Task 6.4)_ — Renders icon + label "AI Suggested". _Req 7.4_

**`AiPrefillContext`** _(Task 6.1)_ — `useAiPrefill()` returns the provided set inside the provider; returns `null` outside. _Req 7.4_

### F. AddListingForm integration (Component, Tests after)

_(Tasks 7.1–7.6)_

| Case                                                             | Expected                                                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual (no `aiPrefilledFields` prop)                             | No `DraftNotice`, no `SafetyDisclaimer`, no badges, no provider in tree. Byte-identical behavior to today.                                                                      |
| Photo-first section order                                        | DOM order: Photos → Basic → Pricing → Pickup → Additional → Policies. _Req 2.1_                                                                                                 |
| Prefilled (full draft)                                           | `DraftNotice` above Photos; badges next to name, description, category, brand, model, condition, specs, instructions, safetyNotes; `SafetyDisclaimer` adjacent to Safety Notes. |
| Prefilled minimal (no safetyNotes/instructions)                  | `SafetyDisclaimer` NOT rendered.                                                                                                                                                |
| Form submission passes existing validation regardless of prefill | Existing Zod validation runs unchanged. _Req 7.3_                                                                                                                               |

### G. Orchestrator (Component, Tests alongside)

**`CreateListingClient`** _(Task 8.1)_

- Mounts with modal open in Choice state and empty form rendered behind.
- Manual selection: modal closes, `modalDismissedThisSession` set, form remains empty and interactive.
- AI selection → simulated `onGenerated(draft, images)` from a mocked modal: modal closes, form remounts with prefill (assert `key` prop changes), banner visible.
- Cancel from AI with photos: photos appear in form; banner NOT rendered (no `aiPrefilledFields`).
- Re-render after dismissal: modal does NOT auto-reopen. _Req 1.6_

### H. End-to-end (Playwright, Tests after) _(Tasks 10.1–10.4)_

All scenarios mock `/api/listings/analyze-image` via `page.route`. No live OpenAI calls in CI.

**10.1 AI happy path**

1. Navigate to `/dashboard/listings/add`.
2. Assert Choice modal visible.
3. Click "Generate from Photos".
4. Upload three fixture images.
5. Click "Generate Listing Draft".
6. Mocked route returns `aiDraft.full` after ~600 ms.
7. Assert modal dismisses; form visible with prefill.
8. Assert `DraftNotice`, `SafetyDisclaimer`, and ≥1 `AISuggestedBadge` are visible.
9. Submit form.
10. Assert listing is created with `approvalStatus === "pending_review"`.

_Req 1.1, 1.5, 2.1, 4.1, 5.1, 7.1, 7.4, 7.5, 7.6, 10.1, 10.2, 10.3_

**10.2 Choice → Manual**

1. Navigate, click "Fill Out Manually".
2. Assert no navigation occurred (URL unchanged), modal dismissed.
3. Complete the form manually and submit.
4. Assert no banner/disclaimer/badges rendered at any point.

_Req 1.4_

**10.3 Cancel from AI flow**

1. Navigate, choose AI, stage 2 photos, cancel.
2. Assert modal dismissed; photos present in form's Photos section.
3. Assert no banner rendered.
4. Assert modal does NOT re-open on user activity.

_Req 1.6, 3.8, 9.5_

**10.4 Failure paths**

1. (a) Mock route → 500. Stage photos, generate. Assert Error state with "Try again" and "Continue manually". Click Continue. Assert modal dismissed, photos preserved.
2. (b) Mock route → 429. Same as above but Error state offers only "Continue manually".

_Req 9.1, 9.2, 9.5_

### I. Manual (UAT) checklist

Reasoned-about cases that automation can verify only partially. Run on at least one iOS Safari and one Android Chrome device.

- [ ] Choice modal renders cleanly on small mobile (375 px) — buttons reachable with one thumb.
- [ ] InstructionsView guidance copy reads natural; the "why" phrases are not preachy.
- [ ] Mobile camera capture launches the system camera on tap (not the photo library).
- [ ] ProcessingView animation does not flicker on iOS Safari; "less than 10 seconds" copy doesn't truncate.
- [ ] Evidence callouts feel earned (not generic): with a model number visible in the photo, the callout reads grounded; with no model number, no claim is made.
- [ ] DraftNotice copy reads as a useful nudge, not a warning.
- [ ] SafetyDisclaimer is clearly higher-attention than DraftNotice without feeling like an error.
- [ ] `AI Suggested` chips don't overwhelm the form (the spec called out "avoid AI-centric styling").
- [ ] Choice → Manual gives an instant transition (no perceptible jank as modal dismisses).
- [ ] Error copy on every reason reads as plain English, not technical.

_Req 6.1, 6.3, 6.5, 7.4, 7.5, 7.6, 9.1, 11.2, 11.3_

## Performance

- Generation request budget: P50 < 6 s, P95 < 12 s end-to-end (Click → modal dismiss). Measured from the `listing_ai_generation_started` to `listing_ai_generation_succeeded` events. If P95 exceeds 12 s in any week post-launch, revisit the simulated-steps tail and the prompt size.
- The simulated step ticker must not block the network call: the call starts immediately on `BEGIN_GENERATE`; the ticker runs in parallel.
- The data-URL conversion of three 2 MB images must complete in < 200 ms on a mid-tier mobile device. Measured with the existing performance instrumentation pattern.

## Security

- **Auth**: the route requires an authenticated session — covered in route tests case "Unauthed".
- **Rate limit**: per-user limit prevents a single account from running up costs — covered in route + limiter tests.
- **Input size**: the existing image-upload pipeline enforces max 10 MB and magic-byte validation, but the analyze route does not currently bound `imageUrls` payload size. **Add a guard**: reject requests where the total decoded image payload exceeds ~30 MB (3 × 10 MB ceiling) before invoking OpenAI. This is a new server-side test case added under route integration tests.
- **Prompt injection via image filename/EXIF**: filenames are not sent to OpenAI; EXIF is not parsed. No new attack surface introduced beyond the existing analyze route.
- **PII**: photos may contain identifying information. Photos sent to OpenAI inherit the existing privacy posture of the analyze endpoint. No change.

## Acceptance — requirements traceability

| Requirement                                                                 | Covered by                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| R1 (entry choice, modal state machine, no auto-reopen)                      | A (reducer), G (orchestrator), H/10.1 H/10.2 H/10.3                                  |
| R2 (Photos first in both flows)                                             | F (form integration), H/10.1                                                         |
| R3 (staged photos, guidance, camera, cancel)                                | D (`InstructionsView`), H/10.3                                                       |
| R4 (explicit trigger, one-shot, server enforcement)                         | B (`useAnalyzeListingDraft` idempotency), A (rate limiter), C (route)                |
| R5 (gpt-4o, category resolution, condition coercion, nulls, no pricing)     | A (`resolveAiDraft`), C (route prompt + resolution), F (no pricing fields prefilled) |
| R6 (processing UX, simulated steps, evidence callouts)                      | A (`useSimulatedSteps`), D (`ProcessingView`), I (manual feel)                       |
| R7 (prefill review, badges, draft banner, safety disclaimer, manual submit) | E (primitives), F (integration), H/10.1, I (manual)                                  |
| R8 (photos persist, no auto-reprocess, no regeneration)                     | G (orchestrator carries `stagedImages`), D (modal is single-shot via reducer)        |
| R9 (graceful errors, low-confidence, recovery, no technical strings)        | B (hook error mapping), C (route low_confidence + 5xx), D (`ErrorView`), H/10.4      |
| R10 (reuse standard flow, approval gate)                                    | F (form unchanged), H/10.1 final assertion                                           |
| R11 (trust, control, mobile-first, predictability)                          | I (manual checklist) plus structural checks in A/D                                   |
| R12 (instrumentation for primary + secondary metrics)                       | C (route logging), G (orchestrator events), F (extended submit event)                |

## What this plan does NOT cover

- Live OpenAI behavior. No automated tests call the live API; cost and flakiness make it the wrong layer. Live verification is a manual smoke after release.
- Cross-region rate-limiter behavior. The in-memory limiter is single-instance; a shared-store migration would re-spec the limiter tests.
- Visual regression. Project doesn't run visual regression today; no need to introduce it for this feature.
- Listing approval/admin flow tests. Those exist in `specs/listing-review/4-test-plan.md` and are unaffected by this feature.
