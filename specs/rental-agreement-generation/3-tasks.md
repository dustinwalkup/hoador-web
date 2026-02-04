# Rental Agreement Auto-Generation - Implementation Tasks

## Overview

This document breaks down the rental agreement auto-generation feature into discrete, actionable tasks. Tasks are ordered by dependencies and grouped into logical phases. Each task can be completed in a single development session and includes references to specific requirements. PDF generation uses Playwright (HTML → PDF); generation runs in a worker or internal API route, not in the approve route.

## Task List

### Phase 1: Setup and Database

- [x] 1. Add Playwright dependency and install browsers
  - Add `playwright` (or `@playwright/test` if E2E config will share it) to `package.json` dependencies
  - Run `npx playwright install chromium` (or document in README for local/CI); use Chromium only for PDF to keep install minimal
  - _Requirements: 2, 3_

- [x] 2. Create rental_agreement_documents schema
  - Create `src/db/schemas/rental-agreement-documents.schema.ts`
  - Define `rentalAgreementDocuments` table: `id` (uuid, PK), `rentalRequestId` (uuid, FK to rental_requests.id, unique, onDelete: cascade), `pdfUrl` (varchar 500), `templateVersion` (varchar 50), `generatedAt` (timestamp, defaultNow)
  - Add unique index on `rentalRequestId`
  - Export table; add relations to `rentalRequests` if desired for queries
  - Register schema in `src/db/schemas/index.ts` and ensure Drizzle config includes it for migrations
  - _Requirements: 4_

- [x] 3. Generate and apply migration for rental_agreement_documents
  - Run `db:generate` (or equivalent) to create migration for `rental_agreement_documents`
  - Run `db:migrate` (or `db:push` per project workflow) to apply migration
  - _Requirements: 4_

### Phase 2: Data Access Layer

- [x] 4. Implement RentalAgreementDocumentDAL
  - Create `src/dal/rental-agreement-document.dal.ts` (or equivalent path per project convention)
  - Implement `create(rentalRequestId, pdfUrl, templateVersion): Promise<{ id, rentalRequestId, pdfUrl, templateVersion, generatedAt }>`; insert one row; return created row
  - Implement `getByRentalRequestId(rentalRequestId): Promise<{ pdfUrl, templateVersion, generatedAt } | null>`; return null if not found
  - Optional: `exists(rentalRequestId): Promise<boolean>` for idempotency check before generating
  - Use BaseDAL/db pattern consistent with existing DALs (e.g. `src/dal/legal-document.dal.ts`)
  - Export from `src/dal/index.ts`
  - _Requirements: 4, 8_

### Phase 3: Template and PDF Generation

- [x] 5. Add HTML template and template version constant
  - Create `src/services/playwright/template.ts`
  - Define `RENTAL_AGREEMENT_TEMPLATE_VERSION = "1.0"` (or similar)
  - Add HTML template string (or template file) for the canonical Hoador Tool and Service Rental Agreement with placeholders: `{{PROVIDER_NAME}}`, `{{RENTER_NAME}}`, `{{TOOL_DESCRIPTION}}`, `{{START_DATE}}`, `{{END_DATE}}`, `{{RENTAL_LOCATION}}`, `{{TOTAL_COST}}`
  - Include all sections from the product template (Parties and Transaction Details, Condition and Inspection, Use and Responsibility, Return of Tools, Service Performance, Deposits/Payments/Refunds, Cancellations and Disputes, Liability and Assumption of Risk, Ownership and Title, Electronic Acceptance, Governing Law)
  - Add a function `renderTemplate(data: RentalAgreementData): string` that replaces placeholders; use sensible defaults (e.g. "N/A") for missing optional fields
  - Define `RentalAgreementData` type: providerName, renterName, toolDescription, startDate, endDate, rentalLocation, totalCost (and optional fields as needed)
  - _Requirements: 2, 6_

- [x] 6. Implement Playwright PDF generation (HTML → buffer)
  - In `src/services/playwright/generate-rental-agreement.ts`, implement `generateRentalAgreementPdf(data: RentalAgreementData): Promise<Buffer>`
  - Use Playwright (Chromium): launch browser (or reuse pool if applicable), newPage(), setContent(html), pdf({ path: null }) or equivalent to get buffer, close page/browser
  - Use HTML from `src/services/playwright/template.ts` via `renderTemplate(data)`; ensure print-friendly styles (e.g. @media print or inline styles for page breaks if needed)
  - Handle errors (e.g. browser launch failure, timeout); log and rethrow so caller can handle
  - _Requirements: 2, 3_

### Phase 4: Orchestration and Worker/Internal API

- [x] 7. Implement “get payload for agreement” and orchestration service
  - Add a method (e.g. on RentalDAL or a small helper) to load rental request + listing + user data and return a `RentalAgreementData`-shaped object (providerName, renterName, toolDescription, startDate, endDate, rentalLocation, totalCost); map from existing rental/listing/user fields per design placeholder table
  - In `src/services/playwright/generate-rental-agreement.ts`, implement `generateAndStoreRentalAgreement(rentalRequestId: string): Promise<string>` (returns pdfUrl): load payload → renderTemplate (from `template.ts`) → generateRentalAgreementPdf → uploadToBlob (pathname e.g. `rental-agreements/${rentalRequestId}.pdf`) → RentalAgreementDocumentDAL.create(rentalRequestId, url, RENTAL_AGREEMENT_TEMPLATE_VERSION) → return url
  - Optional idempotency: if RentalAgreementDocumentDAL.getByRentalRequestId(rentalRequestId) already exists, return existing pdfUrl and skip generation
  - On failure (PDF gen, blob upload, or DB insert), log with rentalRequestId and error; rethrow or return so caller can log (do not block approval)
  - _Requirements: 3, 4, 6, 7_

- [x] 8. Create internal API route for PDF generation (worker entrypoint)
  - Create `src/app/api/internal/generate-rental-agreement/route.ts` (or equivalent; protect with internal auth or secret header if required)
  - POST handler: parse body `{ rentalRequestId: string }`, validate rentalRequestId exists and rental is approved (or at least request exists), call `generateAndStoreRentalAgreement(rentalRequestId)` from `src/services/playwright/generate-rental-agreement.ts`, return 200 with `{ url }` or 500 on failure
  - This route will be invoked by the approve route (fire-and-forget) or by a queue worker; ensure it runs in an environment where Playwright can run (e.g. longer timeout, more memory in Vercel config if needed)
  - _Requirements: 3, 7_

- [x] 9. Trigger async PDF generation from approve route
  - In `src/app/api/rentals/[id]/approve/route.ts`, after `rentalDAL.approveRentalRequest(...)` and payment/security-deposit logic succeed, trigger PDF generation without blocking the response
  - Option A: Fire-and-forget `fetch(INTERNAL_BASE_URL + '/api/internal/generate-rental-agreement', { method: 'POST', body: JSON.stringify({ rentalRequestId: rentalRequest.id }), headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) })`; do not await; catch and log errors so approval still returns 200
  - Option B: If a queue is available, enqueue a job with `{ rentalRequestId }` and return 200; worker will call generateAndStoreRentalAgreement (task 8 can be the worker handler)
  - Ensure approval and notifications still return 200 even if the trigger fails (log only)
  - _Requirements: 3, 7_

### Phase 5: Retrieval and Detail Page

- [x] 10. Resolve rental identifier to request id and update getRentalAgreementAcceptance
  - In `src/dal/legal-document.dal.ts`, add a helper or inline logic to resolve a “rental identifier” (either rental_requests.id or rentals.id) to rental_requests.id: if rental_requests.id = input then requestId = input; else query rentals by id and set requestId = rentals.requestId
  - Update `getRentalAgreementAcceptance(rentalIdOrRequestId: string, userId: string)` to accept either rental id or request id; resolve to requestId as above; verify user is renter or owner of the request
  - First query `rental_agreement_documents` by requestId; if a row exists, return `{ version: row.templateVersion, url: row.pdfUrl }`
  - If no generated document, keep existing behavior: look up user_legal_acceptances for this requestId and per_rental_agreement, then legal_documents URL for that version; if no acceptance, fall back to current `per_rental_agreement` version URL from legal_documents
  - _Requirements: 5, 7_

- [x] 11. Ensure rental detail page passes rental identifier and uses returned URL
  - In `src/features/rentals/components/detail-page/rental-details-server.tsx`, ensure `getRentalAgreementAcceptance(rentalId, userId)` is called with the same `rentalId` used for `getRentalDetailsById` (request id or rental id); no change if already passing rentalId
  - Confirm `rentalAgreementUrl` is passed to content/actions and the “Download rental agreement” button opens it (existing behavior); no UI change required beyond URL now pointing to generated PDF when available
  - _Requirements: 5_

### Phase 6: Testing

- [x] 12. Unit tests for template and RentalAgreementDocumentDAL
  - Add tests for `renderTemplate` from `src/services/playwright/generate-rental-agreements/template.ts`: given RentalAgreementData, output contains expected provider name, renter name, total cost, etc.; missing optional fields yield "N/A" or empty as specified
  - Add unit tests for RentalAgreementDocumentDAL: create returns row with correct rentalRequestId and pdfUrl; getByRentalRequestId returns null when no row, returns row when exists; use test DB or in-memory pattern consistent with project (e.g. `src/dal/__tests__/rental-agreement-document.dal.test.ts`)
  - _Requirements: 2, 4, 6_

- [x] 13. Unit or integration test for generateRentalAgreementPdf
  - Add test that `generateRentalAgreementPdf(mockRentalAgreementData)` from `src/services/playwright/generate-rental-agreements/utils.ts` returns a non-empty Buffer and that the PDF content (e.g. via a PDF parser or text extraction) contains expected strings (e.g. provider name, renter name); mock or real Playwright depending on CI setup
  - _Requirements: 2, 3_

- [x] 14. Integration test for getRentalAgreementAcceptance
  - With a generated document row for a rental request: getRentalAgreementAcceptance(rentalRequestId, renterOrOwnerUserId) returns the generated pdfUrl and templateVersion
  - With a rental id (rentals.id) that has a generated document: getRentalAgreementAcceptance(rentalId, renterOrOwnerUserId) returns the generated pdfUrl (resolves rental id → request id)
  - With no generated document: getRentalAgreementAcceptance returns fallback URL from legal_documents (or acceptance-based URL) when available
  - For wrong user or invalid id: getRentalAgreementAcceptance returns null
  - _Requirements: 5, 7_

- [x] 15. Integration test for approve route and async generation
  - Test that after a successful approve (mocked payment), either (a) the internal API is invoked with the correct rentalRequestId (mock fetch), or (b) a job is enqueued with rentalRequestId; and the approve response is 200
  - Optionally: run the internal route (or worker) with a test rental request id and assert rental_agreement_documents row is created and pdfUrl is set (can mock blob upload)
  - _Requirements: 3, 7_

## Summary

- **Phase 1:** Playwright install; rental_agreement_documents schema and migration.
- **Phase 2:** RentalAgreementDocumentDAL (create, getByRentalRequestId).
- **Phase 3:** `src/services/playwright/template.ts` (HTML template, version constant, RentalAgreementData, renderTemplate); `src/services/playwright/generate-rental-agreement.ts` (generateRentalAgreementPdf: Playwright HTML→buffer).
- **Phase 4:** Get payload for agreement; generateAndStoreRentalAgreement in `src/services/playwright/generate-rental-agreement.ts`; internal API route; approve route triggers async generation.
- **Phase 5:** getRentalAgreementAcceptance resolves rental id → request id, prefers generated doc, fallback; detail page unchanged except URL source.
- **Phase 6:** Unit tests (template, DAL, PDF gen); integration tests (getRentalAgreementAcceptance, approve + trigger).

All requirements (1–8) are covered: renter confirmation unchanged (no tasks); template and placeholders (5, 12); generation at approval (6, 7, 8, 9, 13, 15); storage and data model (2, 3, 4); retrieval and download (10, 11, 14); placeholder mapping (5, 7); error handling (7, 8, 9, 10); audit (4, 8).
