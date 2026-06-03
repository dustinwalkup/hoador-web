# AI Listing Assistant — Requirements Document

## Introduction

The AI Listing Assistant accelerates **initial listing creation** for tools/equipment by drafting listing fields from photos the user uploads. AI is offered only at creation time as a **draft-generation accelerator** — never as an ongoing editing copilot, conversational assistant, or autonomous publishing system. All AI-generated content is fully user-editable before submission, and every listing continues to pass through the existing validation and admin approval (`pending_review`) gate. AI never publishes a listing.

This feature productionizes an existing prototype rather than building greenfield AI. A working OpenAI **gpt-4o** vision integration already exists (`src/services/openai/analyze-tool-image.ts`, `src/app/api/listings/analyze-image/route.ts`, and the `useAnalyzeToolImage` hook), and a test page (`src/app/test-image-upload/page.tsx`) already analyzes images sent as base64 data URLs. The MVP wires this capability into the real create-listing flow (`/dashboard/listings/add`), reusing the existing listing form, Zod validation, Vercel Blob image pipeline, and approval workflow. The AI system acts only as a **prefill/orchestration layer**, not a separate listing management system.

**Scope:** Tools/equipment listings only (`/dashboard/listings/add`). The services creation flow (`/dashboard/services/listings/create`) is out of scope for the MVP because photo-based identification does not fit services.

## Glossary

- **Listing draft (in-memory):** Pre-submission form state held client-side in react-hook-form, including selected image files. No `listings` row exists until the user submits the standard form.
- **Generate Listing Draft:** The single explicit user action that sends staged photos to the AI service.
- **Evidence callout:** A trust message derived from the actual AI response (e.g. "We found a visible model number" when `model` is non-null), as opposed to a scripted progress step.
- **AI Listing Assistant modal:** A single modal dialog layered on top of the standard listing form on the create-listing page. It opens on page load and begins in a **Choice** state ("Generate from Photos" vs. "Fill Out Manually"). Selecting Manual dismisses the modal. Selecting AI transitions the _same_ modal into its AI states (photo guidance → photo upload → "Generate Listing Draft" trigger → processing → success or error/recovery). The underlying form is mounted (empty) behind the modal throughout, so successful generation dissolves the modal into a prefilled form without any navigation step.

## Requirements

### Requirement 1: Listing Creation Entry Choice

**User Story:** As a listing creator, I want to land on the create-listing page and be asked up front whether I want AI help or to fill out the form manually, so that I can pick the fastest path without leaving the page.

#### Acceptance Criteria

1. WHEN the user navigates to the create-listing page THEN the system SHALL render the standard listing form (empty) AND SHALL open the AI Listing Assistant modal on top of it in its **Choice** state.
2. The modal's Choice state SHALL present two options: "Generate from Photos" (AI Assisted) and "Fill Out Manually" (Manual Entry).
3. The system SHALL frame the AI option as "Generate Listing Draft" / "Generate from Photos" and SHALL NOT use language implying autonomous creation (e.g. "AI creates your listing automatically").
4. WHEN the user selects "Fill Out Manually" THEN the system SHALL dismiss the modal and leave the user on the standard listing form to complete manually. No navigation SHALL occur.
5. WHEN the user selects "Generate from Photos" THEN the _same_ modal SHALL transition to the AI photo-instructions/upload state (Requirement 3). The modal SHALL NOT close, and no navigation SHALL occur.
6. Once the modal has been dismissed during a create-listing page session (via Manual selection, cancel from the AI flow, or successful generation), the system SHALL NOT automatically re-open it during that same session.
7. The Choice state and all subsequent modal states SHALL be usable on mobile viewports (mobile-first).

### Requirement 2: Photos Section First in Both Flows

**User Story:** As a listing creator, I want the Photos section to appear first in the form, so that the manual and AI-assisted flows feel consistent.

#### Acceptance Criteria

1. The standard listing form SHALL present sections in the following order: (1) Photos, (2) Basic Information, (3) Pricing & Rental Terms, (4) Pickup & Delivery, (5) Additional Details, (6) Policies & Publish.
2. The reordered Photos-first layout SHALL apply to both the manual flow and the AI-assisted review flow.
3. The system SHALL preserve all existing form behavior (drag-and-drop, HEIC conversion, image compression, reorder, max 10 images, min 1 image) when relocating the Photos section.

### Requirement 3: AI Photo Upload Step (Staged, Not Auto-Submitted)

**User Story:** As a listing creator using AI, I want to upload a few photos inside a focused modal that tells me exactly what kinds of shots to take, so that I stay in control and produce photos the AI can actually work with.

#### Acceptance Criteria

1. The photo upload step SHALL occur inside the AI Listing Assistant modal — not in the underlying form.
2. The modal SHALL display user-friendly, plain-language guidance on what photos to include, with concrete examples for each (e.g. **full tool photo**, **brand/model label or sticker close-up**, **accessories included**, **condition close-up of wear/damage**). Guidance SHALL recommend 3–5 photos and explain _why_ each type helps (e.g. "a clear shot of the model sticker helps us identify the exact tool").
3. WHEN the user adds photos THEN the system SHALL stage them client-side only (in-memory / local preview, within the modal) and SHALL NOT transmit any image to the AI service.
4. The system SHALL NOT perform any background or automatic AI analysis at upload time.
5. WHERE the user is on a mobile device THEN the modal SHALL allow capturing photos from the device camera.
6. The system SHALL allow the user to remove or replace staged photos within the modal before generation.
7. IF the user has staged zero photos THEN the system SHALL disable the "Generate Listing Draft" action.
8. The modal SHALL provide a clear way to exit the AI flow without generating (e.g. close/cancel), which SHALL dismiss the modal and leave the underlying standard form available for fully manual entry.

### Requirement 4: Explicit Generation Trigger and Cost Control

**User Story:** As the business, I want AI processing to occur only after an explicit user action and only once per draft, so that AI cost stays predictable.

#### Acceptance Criteria

1. The system SHALL begin AI processing ONLY after the user explicitly clicks "Generate Listing Draft" inside the AI Listing Assistant modal.
2. WHEN the user clicks "Generate Listing Draft" THEN the system SHALL send the staged photos to the AI service in a single generation request (one gpt-4o call) and SHALL NOT make repeated or background calls.
3. The system SHALL permit only one successful generation per in-memory listing draft (one-shot). The system SHALL NOT offer regeneration loops, conversational refinement, or AI editing within the MVP.
4. IF a generation attempt fails THEN the system MAY allow the user to retry generation (Requirement 9) without counting the failed attempt as the one successful generation.
5. The system SHALL enforce the single-generation and rate constraints server-side, not solely in the UI.
6. The system SHALL transmit photos to the AI service as the staged image data (base64 data URLs), consistent with the existing analyze endpoint, so that no `listings` row or temporary blob upload is required to perform analysis.

### Requirement 5: AI Draft Generation and Field Mapping

**User Story:** As a listing creator, I want AI to draft my listing fields from my photos, so that I can finish faster with less typing.

#### Acceptance Criteria

1. WHEN the AI generation request completes successfully THEN the system SHALL produce draft values for: Title (`name`), Category, Brand, Model, Description, Condition, optional Specifications, Usage Instructions, and Safety Notes.
2. The system SHALL use OpenAI **gpt-4o** via the existing analysis service for generation.
3. The system SHALL map the AI-returned category name to a valid `categoryId` (UUID) using a case-insensitive match against the active `listing_categories`. IF no confident match exists THEN the system SHALL leave Category unset rather than assign an incorrect category.
4. The AI category prompt SHALL cover the full active category catalog (currently 10 categories including "Kids & Baby" and "Miscellaneous"), so that AI suggestions are not silently constrained to a stale subset.
5. The system SHALL coerce the AI-returned condition to the canonical form enum (`new | good | fair | poor`). IF the AI returns a value outside this set (e.g. "excellent") THEN the system SHALL map it to the closest valid enum value or leave Condition unset; the system SHALL NOT submit an invalid enum value to validation.
6. WHERE the AI cannot confidently determine Brand or Model THEN the system SHALL leave those fields blank rather than fabricate a value (favor blank over incorrect).
7. The AI-generated Usage Instructions and Safety Notes SHALL be treated as **editable draft suggestions only**; the system SHALL NOT present them as authoritative and SHALL keep them fully editable before submission. A highly visible disclaimer SHALL accompany these fields per Requirement 7.
8. The system SHALL NOT generate, suggest, or research any pricing value (daily/weekly/monthly rate, deposit). Pricing SHALL remain fully manual.
9. The system SHALL NOT invoke any market-value or external price-research service (e.g. SerpAPI) as part of this feature.

#### BDD Scenario: Successful draft generation

- **Given** a user in the AI flow with 3 staged photos of the same tool
- **When** the user clicks "Generate Listing Draft" and the AI call succeeds
- **Then** the system SHALL prefill the standard listing form with Title, Description, Category (resolved to a valid category), Condition (valid enum), and any confidently identified Brand/Model/Specifications
- **And** the staged photos SHALL remain attached to the draft
- **And** Brand and Model SHALL be blank if not confidently identified

### Requirement 6: AI Processing Experience

**User Story:** As a listing creator, I want a clear, trustworthy processing experience, so that I understand what is happening and feel confident in the result.

#### Acceptance Criteria

1. WHEN generation begins THEN the AI Listing Assistant modal SHALL transition to a dedicated processing state in place (the modal stays open; the underlying form is not navigated to or revealed during processing) and SHALL NOT show a generic indefinite spinner or blank screen.
2. The modal SHALL display a sequence of plain-language progress steps during processing (e.g. "Analyzing photos", "Identifying brand and model", "Drafting description", "Preparing listing draft"). These steps MAY be presented on a timed/animated basis because generation is a single call; they are a perceived-performance device, not literal backend stages.
3. The progress messaging SHALL avoid technical jargon and AI buzzwords (no model names, APIs, or "multimodal inference").
4. The system SHALL set a time expectation (e.g. "This usually takes less than 10 seconds").
5. WHEN generation completes THEN the system SHALL surface evidence callouts derived from the actual AI response (e.g. show "We found a visible model number" only when Model is non-null; "We identified a likely tool category" only when Category resolved). The system SHALL NOT display evidence callouts for fields the AI did not confidently produce.
6. The processing state SHALL be mobile-first and SHALL discourage repeated submission (e.g. by disabling the trigger while in progress).

### Requirement 7: AI Draft Review in the Standard Form

**User Story:** As a listing creator, I want to review and edit the AI draft in the normal form, so that I confirm everything before submitting.

#### Acceptance Criteria

1. WHEN generation completes successfully THEN the system SHALL dismiss the AI Listing Assistant modal and reveal the underlying standard listing form, prefilled with the AI-generated values and the staged photos. The user SHALL NOT need to navigate or click through an intermediate screen.
2. Every prefilled field SHALL be fully editable using the existing form controls.
3. The system SHALL run the existing client and server validation on the (possibly edited) values at submission; AI prefill SHALL NOT bypass any validation rule.
4. WHERE a field was AI-suggested THEN the system MAY display a subtle indicator (e.g. "AI Suggested" label or sparkle icon). Indicators SHALL remain minimal and SHALL NOT make the form feel "AI-centric".
5. WHEN the form is rendered with one or more AI-prefilled values THEN the system SHALL display a prominent, persistent draft notice at the top of the form clearly stating: (a) the listing is a draft generated from the user's photos, (b) AI can make mistakes, and (c) the user is expected to proofread and edit every field before submitting. The notice SHALL remain visible until the listing is submitted and SHALL NOT be dismissible.
6. WHEN the form is rendered with an AI-prefilled Safety Notes value (and/or AI-prefilled Usage Instructions) THEN the system SHALL display a **highly visible, visually distinct** disclaimer adjacent to the Safety Notes field stating that AI-drafted safety guidance is a starting point only, may be incomplete or inaccurate, and that the listing owner is responsible for reviewing and providing accurate, complete safety information for their tool. The disclaimer SHALL use warning/attention styling (e.g. icon + emphasized background), SHALL NOT be collapsed behind a "show more" affordance, and SHALL NOT be dismissible.
7. The system SHALL require the user to confirm and submit the listing manually; the system SHALL NOT auto-submit or auto-publish.

### Requirement 8: Photo Handling After Generation

**User Story:** As a listing creator, I want my uploaded photos to remain the listing's photos and to manage them normally, so that the photos I used are the photos buyers see.

#### Acceptance Criteria

1. The photos used for AI generation SHALL remain attached to the draft and visible throughout the review/edit process as the listing images.
2. WHEN the user adds, removes, or reorders photos after generation THEN the system SHALL apply the change to the draft using existing photo controls.
3. The system SHALL NOT automatically re-run AI analysis when photos are added, removed, or reordered after the initial generation.
4. The system SHALL NOT continuously regenerate or update any field during editing.

### Requirement 9: Error Handling and Low-Confidence Behavior

**User Story:** As a listing creator, I want graceful, non-technical handling when AI cannot identify my tool, so that I can still complete my listing.

#### Acceptance Criteria

1. IF generation fails THEN the AI Listing Assistant modal SHALL display a user-friendly message in place (e.g. "We couldn't confidently identify this tool") and SHALL NOT expose raw/technical errors. The modal SHALL remain open; errors SHALL NOT be surfaced on the underlying form.
2. WHEN generation fails THEN the modal SHALL offer recovery options inline: upload additional photos, try again, or continue with manual listing creation (carrying over the already-staged photos).
3. WHERE AI confidence for a specific field is low THEN the system SHALL prefer leaving that field blank over emitting an incorrect or fabricated value.
4. The system SHALL log generation failures with sufficient context for debugging (without surfacing that detail to the user).
5. IF the user chooses "continue manually" after a failure THEN the system SHALL dismiss the modal and reveal the underlying standard form with the staged photos preserved and no AI-generated field values.

### Requirement 10: Architecture Reuse and Publishing

**User Story:** As an engineer, I want the AI flow to reuse existing listing infrastructure, so that we don't fork the listing system.

#### Acceptance Criteria

1. The system SHALL reuse the existing listing form, existing Zod validation schemas, the existing Vercel Blob image pipeline, and the existing create/publish flow.
2. WHEN an AI-assisted listing is submitted THEN it SHALL follow the identical path as a manual listing, including creation with `approvalStatus = pending_review` and admin review.
3. The system SHALL NOT auto-publish, auto-moderate, or bypass admin review for AI-assisted listings.
4. The AI system SHALL act only as a prefill/orchestration layer and SHALL NOT introduce a separate listing data model or management system.
5. Images SHALL be persisted to durable storage (Vercel Blob) only through the existing post-creation upload path, not during AI analysis.

### Requirement 11: Trust, Transparency, and Quality (Non-Functional)

**User Story:** As a listing creator, I want the AI experience to feel like a polished marketplace workflow, not an experimental AI feature, so that I trust the result.

#### Acceptance Criteria

1. The system SHALL keep the user in explicit control at every step: initiate processing, review all output, and confirm the final listing manually.
2. The system SHALL be mobile-first and SHALL minimize cognitive load, using consistent marketplace patterns.
3. The system SHALL frame value in terms of time saved ("That saved me a lot of time"), not AI novelty.
4. The system SHALL behave predictably and fail gracefully (Requirement 9).
5. The feature SHALL NOT introduce ongoing/continuous AI behavior; AI availability SHALL be limited to initial creation.

### Requirement 12: Success Metrics and Instrumentation

**User Story:** As a product owner, I want the feature instrumented, so that we can measure whether AI assistance improves listing creation.

#### Acceptance Criteria

1. The system SHALL emit events sufficient to measure primary metrics: listing completion time, listing completion rate, listing volume, and abandonment during creation.
2. The system SHALL emit events sufficient to measure secondary metrics: AI generation usage rate, AI draft acceptance rate, average edits after generation, and AI processing cost per successful listing.
3. Instrumentation SHALL distinguish AI-assisted listings from manually created listings.

## Out of Scope (MVP)

- AI editing/rewrite tools, conversational assistant, continuous photo analysis, AI regeneration loops
- Dynamic pricing, market value estimation, real-time repricing, external price research (e.g. SerpAPI)
- Auto-publishing, autonomous moderation
- Services listing flow (`/dashboard/services/listings/create`)
- Standalone safety-instruction tooling (note: AI _prefill_ of editable safety/instruction text is **in** scope per stakeholder decision — see Assumptions)

## Assumptions and Constraints

- **Provider:** The feature reuses the existing OpenAI **gpt-4o** integration. No new AI provider/SDK/key is introduced for the MVP.
- **Safety/instructions decision:** Per stakeholder direction, AI will prefill editable Usage Instructions and Safety Notes (current prototype behavior). This is a deliberate reinterpretation of the "safety instruction generation" out-of-scope line: AI generates _draft, editable suggestions_, not authoritative safety guidance. Because AI-authored safety text on a rental marketplace carries liability, these fields MUST remain clearly editable and a highly visible disclaimer is required (see Requirement 7.6). A separate explicit acknowledgment checkbox for safety notes is **not** in MVP scope but may be added if legal/product requires further hardening. _(Flagged for revisit if legal/product disagrees.)_
- **Condition enum:** The form's canonical condition enum is `new | good | fair | poor`. The current AI prompt emits `excellent | good | fair | poor`; this mismatch MUST be reconciled (preferred: update the prompt to emit the canonical enum) so prefilled values pass validation.
- **Category source of truth:** Categories live in the `listing_categories` table; AI returns a category _name_ that must resolve to a `categoryId`. The AI prompt's category list MUST be kept in sync with the active catalog.
- **Staging mechanism:** Photos are sent to AI as base64 data URLs from client state (matching the existing prototype), so analysis requires no `listings` row and no temporary blob upload.
- **Approval gate unchanged:** All AI-assisted listings enter `pending_review` and are admin-reviewed exactly like manual listings.

## Summary

This feature turns the existing gpt-4o image-analysis prototype into a production "Generate from Photos" path inside the standard create-listing flow for tools/equipment. The user explicitly triggers a single, one-shot AI generation; staged photos are sent only on that action; AI prefills editable form fields (including draft instructions/safety notes per stakeholder decision) plus carries the photos forward; and the user reviews, edits, and submits through the unchanged validation and admin-approval pipeline. AI never auto-publishes, never reprocesses on edit, and never estimates price. Known code reconciliations (condition enum, category coverage, dropping SerpAPI price research) are captured as constraints for the design phase.
