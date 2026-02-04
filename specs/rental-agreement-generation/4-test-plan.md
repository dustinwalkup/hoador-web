# Rental Agreement Auto-Generation - Test Plan

## Overview

This test plan defines how to verify that the rental agreement auto-generation implementation meets the requirements in `specs/rental-agreement-generation/1-requirements.md`. Tests are mapped to requirements, and test types (unit, integration, E2E), framework, coverage goals, and key test cases are specified.

## Requirements Traceability

### Requirement 1: Renter Confirmation at Rental Request

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 1

**Test Coverage**:

- Unit tests: Rent form schema requires `rentalAgreementAccepted` (or equivalent) when present
- Unit tests: Validation rejects submission when agreement not confirmed
- Integration tests: POST /api/rentals records acceptance in user_legal_acceptances with documentId `per_rental_agreement`, rentalRequestId, and current version when renter confirms
- Integration tests: Rent page displays link or preview to agreement and checkbox for confirmation
- Integration tests: New template version used for new acceptances when version is updated
- E2E tests (optional): Rent flow requires checkbox before submit; acceptance recorded

### Requirement 2: Agreement Template and Content

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 2

**Test Coverage**:

- Unit tests: Template contains all required sections (Parties and Transaction Details, Condition and Inspection, Use and Responsibility, Return of Tools, Service Performance, Deposits/Payments/Refunds, Cancellations and Disputes, Liability and Assumption of Risk, Ownership and Title, Electronic Acceptance, Governing Law)
- Unit tests: Template contains placeholders for Provider, Renter, Tool/Service Description, Start/End Date/Time, Rental Location, Total Cost
- Unit tests: `renderTemplate(data)` replaces all placeholders with provided data; missing optional fields yield "N/A" or empty
- Unit tests: Template version constant is defined and used when storing generated documents
- Unit tests: `generateRentalAgreementPdf(mockData)` returns a non-empty Buffer; PDF content (or extracted text) contains expected strings from mock data
- Integration tests: Generated PDF structure matches template sections (e.g. via text extraction or snapshot)

### Requirement 3: Generation at Approval

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 3

**Test Coverage**:

- Unit tests: Generation is NOT invoked when rental request is created (no call to generateAndStoreRentalAgreement in create flow)
- Integration tests: After successful approve (mocked payment), async trigger is invoked with correct rentalRequestId (e.g. fetch to internal API or job enqueued); approve response is 200
- Integration tests: Worker/internal route calls generateAndStoreRentalAgreement; one row created in rental_agreement_documents with correct rentalRequestId, pdfUrl, templateVersion
- Integration tests: Generated PDF contains correct provider name, renter name, tool description, dates, location, total cost (from payload)
- Integration tests: When PDF generation fails (mocked failure), approval still returns 200; error is logged; no block on approval flow
- BDD scenario: Successful generation at approval (Given pending request, When owner approves and payment succeeds, Then PDF generated and stored)
- BDD scenario: No generation at request creation (Given renter submits request, When request created, Then no PDF generated)

### Requirement 4: Storage and Data Model

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 4

**Test Coverage**:

- Unit tests: RentalAgreementDocumentDAL.create(rentalRequestId, pdfUrl, templateVersion) inserts one row; returns row with id, rentalRequestId, pdfUrl, templateVersion, generatedAt
- Unit tests: RentalAgreementDocumentDAL.getByRentalRequestId(rentalRequestId) returns null when no row; returns { pdfUrl, templateVersion, generatedAt } when row exists
- Unit tests: Schema enforces one row per rental_request_id (unique constraint)
- Integration tests: PDF buffer uploaded to blob storage; URL stored in rental_agreement_documents
- Integration tests: No row in legal_documents per rental (only rental_agreement_documents stores generated instance)
- Integration tests: Approved rental has at most one generated document record; unapproved request has none (until approval triggers generation)

### Requirement 5: Retrieval and Download on Rental Detail Page

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 5

**Test Coverage**:

- Unit tests: getRentalAgreementAcceptance(rentalRequestId, userId) returns generated PDF URL when rental_agreement_documents row exists for that requestId and user is renter or owner
- Unit tests: getRentalAgreementAcceptance(rentalId, userId) resolves rental id to request id and returns generated URL when document exists
- Unit tests: getRentalAgreementAcceptance returns null when user is not renter or owner
- Integration tests: Rental detail page receives rentalAgreementUrl when generated document exists; "Download rental agreement" opens correct URL
- Integration tests: When no generated document exists, fallback to current per_rental_agreement URL from legal_documents when available
- Integration tests: Unauthorized user does not receive rental agreement URL (or gets null)
- E2E tests (optional): Renter/owner clicks Download rental agreement and receives filled PDF with correct data

### Requirement 6: Template Placeholder Mapping

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 6

**Test Coverage**:

- Unit tests: Payload builder maps owner display name to providerName, renter display name to renterName, listing name + description (and optional brand/model) to toolDescription, startDate/endDate to startDate/endDate (formatted), delivery or pickup address to rentalLocation, totalAmount to totalCost (formatted as currency)
- Unit tests: Missing optional fields (e.g. deliveryAddress, brand, model) produce "N/A" or empty in payload so document still generates
- Integration tests: End-to-end payload → renderTemplate → PDF contains correct values from rental/listing/user data

### Requirement 7: Error Handling and Edge Cases

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 7

**Test Coverage**:

- Integration tests: PDF generation failure at approval does not return 500 from approve route; error logged with rentalRequestId and message
- Integration tests: When no generated document exists, getRentalAgreementAcceptance returns fallback URL (from legal_documents) when available
- Integration tests: Blob upload failure in worker is logged; no row inserted in rental_agreement_documents; approval already succeeded
- Unit tests: Same stored PDF URL returned on repeated getRentalAgreementAcceptance calls (no regeneration on download)
- Manual/exploratory: Invalid or missing rental id handled (null or error); detail page disables or hides download when URL missing

### Requirement 8: Audit and Compliance

**Requirement Reference**: `specs/rental-agreement-generation/1-requirements.md` - Requirement 8

**Test Coverage**:

- Unit tests: Generated document row includes templateVersion used at generation time
- Integration tests: Renter acceptance at request time still recorded in user_legal_acceptances with documentId per_rental_agreement and version
- Integration tests: Generated PDF retrievable by renter and owner for a rental (authorized access only)

## Test Types and Strategy

### Unit Tests

**Purpose**: Test template rendering, DAL, payload mapping, and PDF generation in isolation.

**Framework**: Vitest

**Coverage Goals**: 80%+ for template, DAL, and payload logic; 60%+ for Playwright PDF helper (may mock browser)

**Areas to Test**:

- **Template (`template.ts`)**: renderTemplate with full and partial RentalAgreementData; placeholder replacement; default "N/A" for missing optionals
- **RentalAgreementDocumentDAL**: create, getByRentalRequestId; unique constraint behavior
- **Payload for agreement**: Mapping from rental request + listing + user to RentalAgreementData (providerName, renterName, toolDescription, dates, location, totalCost)
- **generateRentalAgreementPdf**: With mocked Playwright or real Chromium in CI; output Buffer non-empty and contains expected text snippets

**Test Structure** (AAA):

```typescript
describe("renderTemplate", () => {
  it("replaces all placeholders with provided data", () => {
    const data: RentalAgreementData = { providerName: "Jane", renterName: "John", ... };
    const html = renderTemplate(data);
    expect(html).toContain("Jane");
    expect(html).toContain("John");
    expect(html).not.toContain("{{PROVIDER_NAME}}");
  });
  it("uses N/A for missing optional fields", () => {
    const data = { ...minimalData, rentalLocation: undefined };
    const html = renderTemplate(data);
    expect(html).toContain("N/A"); // or equivalent default
  });
});
```

### Integration Tests

**Purpose**: Test API routes, DAL + blob + DB flow, and getRentalAgreementAcceptance with generated vs fallback URL.

**Framework**: Vitest with mocked or test DB; mock blob upload and optionally Playwright

**Coverage Goals**: Critical flows (approve trigger, internal route, getRentalAgreementAcceptance); 70%+ for integration points

**Areas to Test**:

- **POST /api/rentals**: Records acceptance with per_rental_agreement and rentalRequestId; no PDF generation
- **POST /api/rentals/[id]/approve**: After success, triggers async generation (fetch or queue); response 200; generation failure does not change response
- **POST /api/internal/generate-rental-agreement**: With valid rentalRequestId and approved rental, creates rental_agreement_documents row and uploads PDF (or mocks); returns 200 and url
- **getRentalAgreementAcceptance**: With rentalRequestId or rentalId; returns generated URL when row exists; returns fallback when no row; returns null for wrong user
- **Rental detail server**: Passes rentalId to getRentalAgreementAcceptance; rentalAgreementUrl passed to content

**Mock/Stub Strategy**:

- Mock Vercel Blob `put` to return a fake URL; avoid real blob in tests
- Mock Playwright browser launch or run in CI with Chromium for generateRentalAgreementPdf tests
- Use test DB or mocked DAL for rental_agreement_documents and legal_documents

### End-to-End Tests (Optional)

**Purpose**: Validate full user flow: approve rental → view detail → download agreement.

**Framework**: Playwright (when E2E is adopted) or manual

**Scenarios**:

- Approve a rental (with test payment); open rental detail as renter or owner; click "Download rental agreement"; verify PDF opens and contains correct parties, dates, total cost
- Legacy rental (no generated document): Download button opens generic agreement or fallback URL

### Manual Testing Scenarios

- Approve rental and confirm internal API/worker is invoked (e.g. logs or queue dashboard)
- Confirm approval succeeds even when generation fails (e.g. disconnect blob or break template)
- Confirm fallback URL works when generation has not yet run or failed
- Confirm unauthorized user cannot access rental agreement URL

## Test Data Requirements

- **Rental request**: Approved request with renterId, ownerId, listingId, startDate, endDate, totalAmount, deliveryRequested, deliveryAddress (or pickup)
- **Users**: Renter and owner with display names (firstName, lastName)
- **Listing**: Name, description, optional brand/model
- **RentalAgreementData**: Sample object matching template placeholders for unit tests
- **legal_documents**: At least one row for per_rental_agreement (id, version, url) for fallback tests

## Key Test Cases Summary

| ID  | Scenario                                                         | Type             | Requirement |
| --- | ---------------------------------------------------------------- | ---------------- | ----------- |
| T1  | renderTemplate replaces all placeholders                         | Unit             | 2, 6        |
| T2  | renderTemplate uses N/A for missing optionals                    | Unit             | 2, 6, 7     |
| T3  | RentalAgreementDocumentDAL create/getByRentalRequestId           | Unit             | 4           |
| T4  | generateRentalAgreementPdf returns Buffer with expected text     | Unit             | 2, 3        |
| T5  | Payload maps rental/listing/user to RentalAgreementData          | Unit             | 6           |
| T6  | POST /api/rentals records acceptance, no PDF                     | Integration      | 1, 3        |
| T7  | Approve triggers async generation; 200 even if trigger fails     | Integration      | 3, 7        |
| T8  | Internal route creates document row and blob URL                 | Integration      | 3, 4        |
| T9  | getRentalAgreementAcceptance returns generated URL then fallback | Integration      | 5, 7        |
| T10 | getRentalAgreementAcceptance resolves rentalId → requestId       | Integration      | 5           |
| T11 | Unauthorized user gets null                                      | Integration      | 5           |
| T12 | Generated document includes templateVersion                      | Unit/Integration | 8           |

## BDD Scenarios (from Requirements)

- **Successful generation at approval**: Given pending rental request with valid data, When owner approves and payment succeeds, Then PDF generated and stored with correct parties, tool, dates, location, total cost.
- **No generation at request creation**: Given renter submitting rental request, When request is created, Then no PDF generated; only renter acceptance recorded.
- **Download after approval**: Given approved rental with generated PDF and user is renter or owner, When user clicks Download rental agreement, Then filled PDF opens with correct data.

## Security and Performance

- **Security**: Internal API route for generation should be protected (e.g. internal-only URL, secret header, or queue worker with no public endpoint); tests verify unauthorized callers cannot trigger generation or access other rentals’ documents.
- **Performance**: PDF generation runs in worker/internal route; approve route must not await it. Tests verify approve response time is not blocked by generation. Playwright/Chromium cold start may be slow in CI; consider mocking for speed or allowing longer timeout for PDF tests.

## Summary

Tests are mapped to all eight requirements. Unit tests cover template, DAL, payload mapping, and PDF generation. Integration tests cover rent/approve flows, internal API, and getRentalAgreementAcceptance (generated vs fallback, auth). Optional E2E and manual scenarios cover full download flow and failure modes. Use Vitest; mock blob and optionally Playwright where appropriate; ensure approval is never blocked by generation failures.
