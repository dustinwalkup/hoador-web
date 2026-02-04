# Rental Agreement Auto-Generation - Requirements Document

## Introduction

The Rental Agreement Auto-Generation feature produces a filled, per-rental PDF of the Hoador Tool and Service Rental Agreement for each approved rental. The agreement is generated when the owner (provider) approves the rental request. The renter confirms acceptance of the agreement terms when submitting the rental request; the filled document is created at approval and is available for download by both parties on the rental detail page.

The legal document type remains `per_rental_agreement`. Each rental has one generated PDF that includes the provider name, renter name, tool/service description, rental dates, location, and total cost, in accordance with the canonical agreement template. The system stores the generated PDF URL per rental for audit and download.

## Requirements

### Requirement 1: Renter Confirmation at Rental Request

**User Story:** As a renter, I want to confirm that I agree to the rental agreement terms when submitting a rental request, so that my acceptance is recorded before the rental is approved.

#### Acceptance Criteria

1. WHEN a renter submits a rental request THEN the system SHALL require confirmation that the renter agrees to the Hoador Tool and Service Rental Agreement (e.g. checkbox or equivalent).
2. IF the renter does not confirm agreement THEN the system SHALL prevent submission of the rental request and SHALL display a validation error.
3. WHEN the renter confirms and submits the rental request THEN the system SHALL record the acceptance in the legal acceptances audit trail with:
   - Document ID: `per_rental_agreement`
   - Current template/document version identifier
   - Rental request ID (link to the specific request)
   - User ID (renter)
   - Timestamp, IP address, and user agent (where available)
4. The system SHALL continue to display a link or preview to the agreement (generic or sample) on the rent page so the renter can read the terms before confirming.
5. WHERE the agreement content is updated (new template version) THEN the system SHALL use the current version identifier when recording acceptances for new rental requests.

### Requirement 2: Agreement Template and Content

**User Story:** As a system, I need a single canonical template for the Tool and Service Rental Agreement, so that every generated PDF uses the same terms and structure.

#### Acceptance Criteria

1. The system SHALL maintain one canonical template for the per-rental agreement that includes all sections specified in the product template (Parties and Transaction Details, Condition and Inspection, Use and Responsibility, Return of Tools, Service Performance, Deposits/Payments/Refunds, Cancellations and Disputes, Liability and Assumption of Risk, Ownership and Title, Electronic Acceptance, Governing Law).
2. The template SHALL include placeholders for transaction-specific data: Provider, Renter, Tool/Service Description, Rental Start Date/Time, Rental End Date/Time, Rental Location, Total Cost.
3. The system SHALL support template versioning so that acceptances and generated documents can reference the template version that was in effect (e.g. for audit and dispute resolution).
4. The generated PDF SHALL be a single document (e.g. PDF) suitable for download and archival.

### Requirement 3: Generation at Approval

**User Story:** As a system, I need to generate the filled rental agreement PDF when the owner approves the rental request, so that a stable, auditable document exists for the approved rental.

#### Acceptance Criteria

1. WHEN the owner approves a rental request (and payment succeeds, where applicable) THEN the system SHALL generate the filled rental agreement PDF for that rental request.
2. The system SHALL NOT generate the rental agreement PDF when the renter submits the rental request; generation SHALL occur only at approval.
3. WHEN generating the PDF THEN the system SHALL populate the template with:
   - Provider: owner name and/or user ID (from rental/listing data)
   - Renter: renter name and/or user ID (from rental data)
   - Tool/Service Description: listing name and description (and optional brand/model where available)
   - Rental Start Date/Time and End Date/Time: from the rental request
   - Rental Location: pickup address or delivery address (from rental/listing data, as applicable)
   - Total Cost: total amount for the rental
4. IF generation fails (e.g. template error, storage failure) THEN the system SHALL log the error and SHALL NOT block approval; the approval flow SHALL complete, and the system MAY retry generation or surface the failure for support.
5. The system SHALL use the current template version identifier when generating and storing the document.

#### BDD Scenario: Successful generation at approval

- **Given** a pending rental request with valid renter, owner, listing, dates, and total amount
- **When** the owner approves the rental request and payment succeeds
- **Then** the system SHALL generate a filled rental agreement PDF
- **And** the system SHALL store the generated PDF URL (or pathname) linked to the rental request
- **And** the document SHALL contain the correct provider name, renter name, tool description, dates, location, and total cost

#### BDD Scenario: No generation at request creation

- **Given** a renter submitting a new rental request
- **When** the rental request is created successfully
- **Then** the system SHALL NOT generate a rental agreement PDF at that time
- **And** the system SHALL only record the renter's acceptance of the agreement terms

### Requirement 4: Storage and Data Model

**User Story:** As a system, I need to store the generated rental agreement PDF per rental request, so that both parties can download the same document and we maintain an audit trail.

#### Acceptance Criteria

1. The system SHALL persist one generated document record per rental request (one-to-one relationship).
2. Each record SHALL include at minimum:
   - Rental request ID (foreign key; unique so only one generated document per request)
   - Generated PDF URL (or blob pathname/identifier) where the PDF is stored
   - Template version identifier used to generate the document
   - Timestamp when the document was generated
3. The system SHALL store the PDF file in durable blob storage (e.g. Vercel Blob) and SHALL store the URL (or pathname) in the database.
4. WHERE a rental request has not been approved THEN the system SHALL NOT have a generated document record for that request.
5. The system SHALL NOT create a new row in the existing `legal_documents` table per rental; `legal_documents` SHALL remain used for document type and template versioning (e.g. `per_rental_agreement`), and the generated instance SHALL be stored in a dedicated table (e.g. `rental_agreement_documents`).

### Requirement 5: Retrieval and Download on Rental Detail Page

**User Story:** As a renter or provider, I want to download the filled rental agreement from the rental detail page, so that I have a copy of the agreement for the specific rental.

#### Acceptance Criteria

1. WHEN a renter or provider (owner) views the rental detail page for an approved rental THEN the system SHALL make available a "Download rental agreement" (or equivalent) action that returns or opens the filled PDF for that rental.
2. WHEN the user triggers download THEN the system SHALL return the URL of the generated PDF stored for that rental request (or the rental derived from that request).
3. IF no generated document exists for the rental (e.g. legacy rental or generation failure) THEN the system MAY fall back to the current generic `per_rental_agreement` document URL from `legal_documents` so that a document is still available; the fallback SHALL be clearly acceptable for backward compatibility.
4. WHERE the user is not the renter or owner of the rental THEN the system SHALL NOT provide access to the rental agreement (unauthorized).
5. The system SHALL resolve the rental agreement URL using the rental request ID (or rental ID that maps to the request) so that the correct generated document is returned.

#### BDD Scenario: Download after approval

- **Given** an approved rental with a generated rental agreement PDF
- **And** the current user is the renter or the owner
- **When** the user clicks "Download rental agreement" on the rental detail page
- **Then** the system SHALL open or return the filled PDF for that rental
- **And** the PDF SHALL contain the correct parties, tool, dates, location, and total cost

### Requirement 6: Template Placeholder Mapping

**User Story:** As a system, I need to map rental and listing data to template placeholders, so that the generated document is accurate and complete.

#### Acceptance Criteria

1. Provider SHALL be populated from the rental/listing owner display name (and optionally user ID).
2. Renter SHALL be populated from the rental renter display name (and optionally user ID).
3. Tool/Service Description SHALL be populated from the listing name and description; the system MAY include brand and model where available.
4. Rental Start Date/Time and Rental End Date/Time SHALL be populated from the rental request start and end dates (formatted appropriately for the document).
5. Rental Location SHALL be populated from pickup address or delivery address associated with the rental/listing, depending on what is applicable (e.g. delivery address if delivery requested, otherwise pickup/location).
6. Total Cost SHALL be populated from the rental request total amount (formatted as currency).
7. WHERE a value is missing (e.g. optional field) THEN the system SHALL use a sensible default (e.g. "N/A" or empty) so that the document still generates without errors.

### Requirement 7: Error Handling and Edge Cases

**User Story:** As a system, I need to handle generation and retrieval failures gracefully, so that approval and download flows remain usable.

#### Acceptance Criteria

1. IF PDF generation fails at approval THEN the system SHALL log the failure with sufficient context (rental request ID, error message) and SHALL NOT block the approval or payment flow.
2. IF the user requests download and no generated document exists THEN the system SHALL fall back to the current generic `per_rental_agreement` document when available, as specified in Requirement 5.
3. IF blob storage is unavailable or the stored URL is invalid at download time THEN the system SHALL surface an appropriate error to the user (e.g. "Document temporarily unavailable") and SHALL log the error.
4. The system SHALL NOT regenerate the PDF on every download; the same stored PDF SHALL be returned for the lifetime of the rental (unless a deliberate regeneration feature is added later).

### Requirement 8: Audit and Compliance

**User Story:** As an operator, I need the system to support audit and compliance by tying generated documents to the rental and template version.

#### Acceptance Criteria

1. Each generated document record SHALL be tied to a specific rental request and SHALL include the template version identifier used at generation time.
2. Renter acceptance of the agreement terms at request time SHALL continue to be recorded in the existing legal acceptances table with document ID `per_rental_agreement` and the version in effect at that time.
3. The system SHALL allow retrieval of the generated PDF for a rental by authorized users (renter, owner) for the duration that the rental data is retained.

## Assumptions and Constraints

- The legal document ID for this agreement type is and remains `per_rental_agreement`; no new document ID is introduced.
- Existing `user_legal_acceptances` and `legal_documents` usage (e.g. for static/generic documents and versioning) remains in place; this feature adds generated instance storage and generation logic.
- Provider (owner) acceptance of the same agreement at approval time is out of scope for this document; it can be added in a future requirement set if desired.
- Template text is assumed to be the canonical Hoador Inc. Tool and Service Rental Agreement as provided; legal review of wording is outside this specification.

## Summary

This feature adds on-demand (at-approval) generation of a filled rental agreement PDF per rental, storage of that PDF in blob storage and a new table, and retrieval of the stored PDF on the rental detail page for download by renter and provider. The renter continues to confirm the agreement terms at rental request; the filled document is created only when the owner approves the rental.
