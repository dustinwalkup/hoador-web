# Rental Agreement Auto-Generation - Implementation Notes

## Summary of the Specification

The feature auto-generates a filled, per-rental PDF of the Hoador Tool and Service Rental Agreement when the owner approves a rental request. The renter confirms acceptance of the agreement terms at rental request time; the filled PDF is created at approval and stored in blob storage and a new table (`rental_agreement_documents`). The rental detail page serves the generated PDF URL for download by renter and owner; if no generated document exists (legacy or failure), the page falls back to the generic `per_rental_agreement` document from `legal_documents`.

**Key documents:**

- [1-requirements.md](1-requirements.md) – EARS requirements and BDD scenarios
- [2-design.md](2-design.md) – Architecture, Playwright (HTML → PDF), async generation, data model
- [3-tasks.md](3-tasks.md) – Ordered implementation tasks (Phases 1–6)
- [4-test-plan.md](4-test-plan.md) – Test coverage mapped to requirements, unit/integration/E2E strategy

## Critical Implementation Details

1. **Generation runs outside the approve route.** Playwright (Chromium) must not run in the same serverless function as the approve API. Trigger generation asynchronously (fire-and-forget internal API or queue + worker) after approval and payment succeed. The approve response must remain 200 even if the trigger or generation fails.
2. **Resolve rental id → request id.** The detail page may pass either a rental request id or a rental id. `getRentalAgreementAcceptance` must resolve to a single rental request id before querying `rental_agreement_documents`; if the input is a rental id, look up `rentals.requestId`.
3. **Fallback URL.** When no row exists in `rental_agreement_documents`, return the current `per_rental_agreement` URL from `legal_documents` (or the version the renter accepted) so the Download button still works for legacy rentals or when generation has not completed or failed.
4. **One document per rental request.** The table has a unique constraint on `rental_request_id`. Optional idempotency: if a row already exists for the request, skip generation and return the existing `pdfUrl`.
5. **Template version.** Use `RENTAL_AGREEMENT_TEMPLATE_VERSION` from `src/services/playwright/template.ts` when creating `rental_agreement_documents` rows so audits can tie documents to the template version.

## Decisions and Deviations

- **Playwright chosen over @react-pdf/renderer:** Team plans E2E with Playwright; one dependency for PDF and E2E. Trade-off: generation must run in a worker or internal route with longer timeout/more memory, not in the approve route.
- **Template in code:** `src/services/playwright/template.ts` holds the HTML template and version constant; no admin UI for template content.
- **Internal API as MVP trigger:** Approve route can call `POST /api/internal/generate-rental-agreement` fire-and-forget; a queue + worker can replace this later. The internal route must be deployed where Playwright can run.

## Coding Standards

Apply project coding standards as defined in [.ai/AI-coding-standards.md](.ai/AI-coding-standards.md):

- **DRY:** Reuse `uploadToBlob` from `src/services/vercel-blob`; reuse DAL patterns from existing DALs (e.g. `legal-document.dal.ts`, `rental-agreement-document.dal.ts`).
- **Naming:** PascalCase for components/classes; camelCase for functions/variables; kebab-case for file names where applicable. Use `RentalAgreementData`, `generateAndStoreRentalAgreement`, `getByRentalRequestId`.
- **JSDoc:** Document exported functions and the payload shape (`RentalAgreementData`) with purpose, parameters, and return values.
- **Formatting:** Prettier, 2-space indent, 100-char line length, single quotes, semicolons (per project rules).
- **TypeScript:** Strict types; avoid `any`. Use explicit return types for public functions.
- **Error handling:** Use toast (or project pattern) for user-facing errors; log with context (e.g. `rentalRequestId`, error message) for generation failures. Do not block approval on generation errors.

## TDD

Where applicable, follow [.ai/AI-tdd-methodology.md](.ai/AI-tdd-methodology.md): write failing tests first for template rendering, DAL methods, and payload mapping; then implement. The test plan ([4-test-plan.md](4-test-plan.md)) defines unit tests for `renderTemplate`, `RentalAgreementDocumentDAL`, and `generateRentalAgreementPdf`; use those scenarios in Red–Green–Refactor cycles. Integration tests can be written alongside or after the implementation; approval-flow tests should verify that the approve response is 200 and that the async trigger is invoked without awaiting.

## File Structure

```
src/
  db/schemas/
    rental-agreement-documents.schema.ts   # Table rental_agreement_documents
  dal/
    rental-agreement-document.dal.ts       # create, getByRentalRequestId
    legal-document.dal.ts                 # getRentalAgreementAcceptance (updated)
  services/
    playwright/
      template.ts                         # RENTAL_AGREEMENT_TEMPLATE_VERSION, HTML, renderTemplate, RentalAgreementData
      generate-rental-agreement.ts        # getPayloadForRentalAgreement, generateRentalAgreementPdf, generateAndStoreRentalAgreement
    vercel-blob/
      index.ts                            # uploadToBlob (existing)
  app/api/
    internal/
      generate-rental-agreement/
        route.ts                          # POST { rentalRequestId }; calls generateAndStoreRentalAgreement
    rentals/
      [id]/
        approve/
          route.ts                        # After approval success, trigger async generation (fire-and-forget or enqueue)
  features/rentals/components/detail-page/
    rental-details-server.tsx             # Pass rentalId to getRentalAgreementAcceptance; no UI change
specs/rental-agreement-generation/
  1-requirements.md
  2-design.md
  3-tasks.md
  4-test-plan.md
  5-implementation-notes.md
```

## Naming Conventions for This Feature

- **Types:** `RentalAgreementData`, `RentalAgreementDocumentRow` (or as in DAL).
- **Constants:** `RENTAL_AGREEMENT_TEMPLATE_VERSION` (e.g. `"1.0"`).
- **Functions:** `renderTemplate(data)`, `generateRentalAgreementPdf(data)`, `generateAndStoreRentalAgreement(rentalRequestId)`, `getPayloadForRentalAgreement(rentalRequestId)` (or equivalent).
- **DAL:** `RentalAgreementDocumentDAL.create`, `RentalAgreementDocumentDAL.getByRentalRequestId`.
- **Placeholders in template:** `{{PROVIDER_NAME}}`, `{{RENTER_NAME}}`, `{{TOOL_DESCRIPTION}}`, `{{START_DATE}}`, `{{END_DATE}}`, `{{RENTAL_LOCATION}}`, `{{TOTAL_COST}}`.
- **Blob pathname:** `rental-agreements/${rentalRequestId}.pdf` (or with timestamp if preferred).

## Error Handling

- **Approve route:** When triggering generation (fetch or enqueue), catch errors and log only; do not rethrow. Approval and notifications must still return 200.
- **Internal API route / worker:** On `generateAndStoreRentalAgreement` failure, log with `rentalRequestId` and error; return 500 and `{ error: "..." }`. Do not retry indefinitely; optional retry policy can be added later.
- **getRentalAgreementAcceptance:** If resolution fails (invalid id, not renter/owner), return null. If no generated document, fall back to existing logic (acceptance + legal_documents URL or current per_rental_agreement URL).
- **Payload loading:** If rental request, listing, or user not found, throw or return a structured error so the caller can log and respond with 404/500.

## Logging and Monitoring

- **Generation triggered:** Log at info (or debug) that async generation was triggered for `rentalRequestId` (avoid logging full payload).
- **Generation failed:** Log at error with `rentalRequestId` and error message (and stack in non-production if useful).
- **Blob upload failed:** Log at error with `rentalRequestId`; do not insert into `rental_agreement_documents` so fallback URL is used.
- **Approval flow:** Do not log success of the fire-and-forget trigger as approval success; approval success is independent. Optionally log if the trigger call itself fails (e.g. fetch threw).

## Implementation Checklist

Use [3-tasks.md](3-tasks.md) as the source of truth. High-level order:

1. **Phase 1:** Playwright dependency; `rental_agreement_documents` schema; migration.
2. **Phase 2:** `RentalAgreementDocumentDAL` (create, getByRentalRequestId); export from dal index.
3. **Phase 3:** `src/services/playwright/template.ts` (version, HTML, `RentalAgreementData`, `renderTemplate`); `generateRentalAgreementPdf` in `generate-rental-agreement.ts`.
4. **Phase 4:** Payload helper; `generateAndStoreRentalAgreement`; internal API route; approve route trigger (fire-and-forget or enqueue).
5. **Phase 5:** `getRentalAgreementAcceptance` resolves rental id → request id, prefers `rental_agreement_documents`, then fallback; rental detail page passes `rentalId` (no UI change).
6. **Phase 6:** Unit and integration tests per [4-test-plan.md](4-test-plan.md).

## Test Plan Reference

Tests are defined in [4-test-plan.md](4-test-plan.md). Key areas:

- **Unit:** `renderTemplate`, `RentalAgreementDocumentDAL`, payload mapping, `generateRentalAgreementPdf` (mock or real Playwright).
- **Integration:** Rent flow records acceptance and does not generate PDF; approve triggers async generation and returns 200; internal route creates document row and blob URL; `getRentalAgreementAcceptance` returns generated URL then fallback, resolves rental id, and enforces auth.
- **E2E (optional):** Approve → view detail → download agreement and verify PDF content.

Run tests with Vitest; mock blob and optionally Playwright in CI if needed. Ensure approval route tests do not depend on generation succeeding.

## Gotchas and Known Challenges

1. **Playwright in serverless:** Chromium is heavy. Do not run it in the same function as the approve route. The internal route (or worker) must have sufficient memory and timeout (e.g. Vercel config or separate service). If using Vercel, confirm the internal route is deployed with a runtime that supports Playwright or use a queue + external worker.
2. **Rental id vs request id:** The detail page uses `getRentalDetailsById(rentalId)`, where `rentalId` can be a request id (for pending) or a rental id (for approved). `getRentalAgreementAcceptance` must accept both and resolve to request id; otherwise the generated document (keyed by request id) will not be found when the user navigates with a rental id.
3. **Fire-and-forget fetch:** If the approve route calls the internal API with `fetch(..., { signal: AbortSignal.timeout(5000) })` and does not await, the request may be aborted by the client or server when the response is sent. Ensure the internal route is invoked (e.g. by a queue or by a longer-lived process) or that the trigger is best-effort and fallback URL is acceptable until the next run.
4. **Existing schema/DAL:** The project may already have `rental_agreement_documents` schema and `RentalAgreementDocumentDAL` from earlier work; merge with this spec and avoid duplicate tables or exports.
5. **Template changes:** When updating the agreement text or placeholders, bump `RENTAL_AGREEMENT_TEMPLATE_VERSION` and ensure new generated documents use the new version; existing rows keep their stored version for audit.

---

**Implementation can begin.** Follow the task list in order; run tests from the test plan as you complete each phase. If you discover gaps or need to deviate, update the relevant spec document and this implementation notes file.
