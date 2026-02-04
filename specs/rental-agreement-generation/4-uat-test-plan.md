# Rental Agreement Auto-Generation - User Acceptance Test Plan

## Overview

This document provides User Acceptance Test (UAT) cases for the Rental Agreement Auto-Generation feature. UAT validates that the feature works correctly from an end-user perspective: renter confirmation at rental request, PDF generation at approval, and download of the filled agreement on the rental detail page. These tests should be executed by business stakeholders, QA team, or end users before feature release.

**Feature**: Rental Agreement Auto-Generation  
**Version**: 1.0  
**Date**: 2025  
**Test Environment**: Staging (prefer staging so PDF generation and blob storage can run; production after validation)  
**Reference Documents**:

- Requirements: `specs/rental-agreement-generation/1-requirements.md`
- Design: `specs/rental-agreement-generation/2-design.md`
- Implementation Tasks: `specs/rental-agreement-generation/3-tasks.md`
- Test Plan: `specs/rental-agreement-generation/4-test-plan.md`
- Implementation Notes: `specs/rental-agreement-generation/5-implementation-notes.md`

## Test Objectives

1. Verify that the renter must confirm the rental agreement before submitting a rental request and that acceptance is recorded.
2. Verify that the rent page displays a link or preview to the agreement so the renter can read terms before confirming.
3. Validate that no PDF is generated when the renter submits the rental request (only when the owner approves).
4. Confirm that when the owner approves a rental (and payment succeeds), a filled PDF is generated and stored for that rental.
5. Verify that both renter and owner can download the filled rental agreement from the rental detail page after approval.
6. Confirm that the downloaded PDF contains the correct provider name, renter name, tool description, dates, location, and total cost.
7. Validate that when no generated document exists (e.g. legacy rental or generation not yet complete), the user can still download a document (fallback to generic agreement).
8. Ensure that users who are not the renter or owner cannot access the rental agreement.
9. Confirm that approval and payment succeed even if PDF generation fails (approval is not blocked).
10. Verify that the approval flow completes and returns success without waiting for PDF generation.

## Test Scenarios

### Scenario 1: Renter Confirms Agreement and Submits Rental Request - Happy Path

**User Story**: As a renter, I want to confirm that I agree to the rental agreement terms when submitting a rental request, so that my acceptance is recorded before the rental is approved.

**Preconditions**:

- User is logged in and authenticated as a renter
- User is on the rent page for a valid listing (not their own)
- Listing has availability for the selected dates
- User has added dates and any other required fields

**Test Steps**:

1. Navigate to the rent page for a listing (e.g. from listing detail page)
2. Select rental start and end dates (and any other required fields)
3. Verify a link or preview to the "Hoador Tool and Service Rental Agreement" (or equivalent) is visible
4. Verify a checkbox (or equivalent) for "I agree to the Hoador Tool and Service Rental Agreement" is present
5. Do not check the agreement checkbox; attempt to submit the form
6. Verify submission is prevented and a validation message appears
7. Check the agreement checkbox
8. Submit the rental request form
9. Wait for submission to complete
10. Verify success message and that the rental request was created (e.g. redirect to rental detail or dashboard)

**Expected Results**:

- ✅ Link or preview to the agreement is visible so the renter can read terms
- ✅ Checkbox (or equivalent) for agreeing to the agreement is present and required
- ✅ Form cannot be submitted without confirming the agreement; validation error is shown
- ✅ After confirming and submitting, the request is created successfully
- ✅ Success message is displayed
- ✅ Acceptance is recorded (verifiable in backend/DB: user_legal_acceptances with documentId per_rental_agreement and rentalRequestId)
- ✅ No PDF is generated at this step (only acceptance is recorded)

**Test Data**:

- Valid listing with available dates
- Renter user account
- Dates and optional fields (delivery, message, etc.) as needed

**Priority**: Critical  
**Requirement Reference**: Requirement 1 - Renter Confirmation at Rental Request

---

### Scenario 2: Renter Can Read Agreement Before Confirming

**User Story**: As a renter, I want to read the agreement terms before confirming, so that I know what I am agreeing to.

**Preconditions**:

- User is logged in as a renter
- User is on the rent page for a listing

**Test Steps**:

1. On the rent page, locate the link or control to view the rental agreement
2. Click the link (or open preview) to view the agreement
3. Verify the agreement content is displayed (e.g. generic/sample agreement or new tab with document)
4. Verify the document includes key sections (e.g. Parties, Condition and Inspection, Use and Responsibility, etc.) or a clear sample
5. Close or go back to the rent form
6. Confirm the checkbox and submit

**Expected Results**:

- ✅ Link or preview to the agreement is visible and accessible
- ✅ User can open and read the agreement (or a representative sample) before confirming
- ✅ Content is readable and includes expected sections
- ✅ User can return to the form and complete submission after reading

**Test Data**:

- Rent page for any valid listing

**Priority**: High  
**Requirement Reference**: Requirement 1.4 - Display link/preview to agreement

---

### Scenario 3: Owner Approves Rental - PDF Generated and Available

**User Story**: As an owner, I want to approve a rental request so that the rental is confirmed and a filled agreement is generated for the transaction.

**Preconditions**:

- User is logged in as the listing owner (provider)
- A pending rental request exists for one of the owner's listings
- Renter has a valid payment method on file
- Owner has completed Stripe Connect onboarding (if required)
- PDF generation (worker or internal route) is running and reachable

**Test Steps**:

1. Navigate to the rental request (e.g. from dashboard, lending, or notifications)
2. Open the rental detail / approve flow
3. Optionally add pickup and return instructions
4. Submit approval (and complete payment flow if applicable)
5. Wait for approval to complete (success response)
6. Verify success message and that the rental status is approved/active
7. As owner or renter, navigate to the rental detail page for this rental
8. Verify "Download rental agreement" (or equivalent) is visible and enabled
9. Click "Download rental agreement"
10. Verify a PDF opens (or downloads) and that it is the filled agreement for this rental
11. In the PDF, verify: provider (owner) name, renter name, tool/service description, rental start and end dates, rental location, and total cost match the rental data

**Expected Results**:

- ✅ Owner can approve the rental request; approval completes successfully (e.g. 200 response, success message)
- ✅ Approval is not blocked by PDF generation (response returns without waiting for PDF)
- ✅ After approval, "Download rental agreement" is available on the rental detail page for both renter and owner
- ✅ Downloaded PDF is the filled agreement (not a generic blank)
- ✅ PDF contains correct provider name, renter name, tool description, dates, location, and total cost
- ✅ PDF is a single document suitable for download and archival
- ✅ Only one generated document exists per rental (no duplicate PDFs for same rental)

**Test Data**:

- Pending rental request with valid renter, payment method, and listing
- Owner account with completed onboarding

**Priority**: Critical  
**Requirement Reference**: Requirement 3 - Generation at Approval; Requirement 4 - Storage; Requirement 5 - Retrieval and Download; Requirement 6 - Template Placeholder Mapping

---

### Scenario 4: Renter Downloads Filled Agreement After Approval

**User Story**: As a renter, I want to download the filled rental agreement from the rental detail page so that I have a copy for the specific rental.

**Preconditions**:

- User is logged in as the renter
- Rental has been approved and PDF generation has completed (generated document exists for this rental)
- User is on the rental detail page for this rental

**Test Steps**:

1. Navigate to the rental detail page (e.g. from dashboard, "Renting" or "My Rentals")
2. Verify "Download rental agreement" (or equivalent) button/link is visible
3. Click "Download rental agreement"
4. Verify a PDF opens in a new tab or downloads
5. Open the PDF and verify it contains: renter name (matches current user), owner (provider) name, listing/tool description, rental dates, location (or "N/A" if not applicable), and total cost
6. Verify the document looks complete (sections present, no missing placeholders like "{{PROVIDER_NAME}}")

**Expected Results**:

- ✅ "Download rental agreement" is visible and enabled for the renter
- ✅ Clicking it opens or downloads the filled PDF
- ✅ PDF contains the correct parties, tool, dates, location, and total cost for this rental
- ✅ No raw placeholder text appears in the PDF
- ✅ Same URL/document is returned on subsequent downloads (no regeneration)

**Test Data**:

- Approved rental with generated agreement PDF
- Renter user account

**Priority**: Critical  
**Requirement Reference**: Requirement 5 - Retrieval and Download on Rental Detail Page; Requirement 6 - Template Placeholder Mapping

---

### Scenario 5: Owner (Provider) Downloads Filled Agreement After Approval

**User Story**: As a provider, I want to download the filled rental agreement from the rental detail page so that I have a copy for the specific rental.

**Preconditions**:

- User is logged in as the owner (provider)
- Rental has been approved and PDF generation has completed
- User is on the rental detail page for this rental (lending view)

**Test Steps**:

1. Navigate to the rental detail page as the owner (e.g. from "Lending" or dashboard)
2. Verify "Download rental agreement" is visible
3. Click "Download rental agreement"
4. Verify the same filled PDF opens (or downloads) as for the renter
5. Verify PDF contains correct provider name (matches current user), renter name, tool description, dates, location, and total cost

**Expected Results**:

- ✅ Owner can download the same filled agreement as the renter
- ✅ PDF content is correct for this rental
- ✅ Owner and renter see the same document (same URL/content)

**Test Data**:

- Approved rental with generated agreement
- Owner user account

**Priority**: Critical  
**Requirement Reference**: Requirement 5 - Retrieval and Download

---

### Scenario 6: Download When No Generated Document Exists (Fallback)

**User Story**: As a renter or owner, I want to still be able to download a rental agreement when the generated PDF is not yet available or does not exist (e.g. legacy rental), so that I always have access to agreement terms.

**Preconditions**:

- User is logged in as renter or owner of a rental
- Either: (a) rental was approved but PDF generation has not completed yet, or (b) rental is a legacy approved rental with no generated document, or (c) generation failed for this rental
- A generic per_rental_agreement document exists in the system (legal_documents has a row for per_rental_agreement)

**Test Steps**:

1. Navigate to the rental detail page for the rental (as renter or owner)
2. Verify "Download rental agreement" (or equivalent) is visible
3. Click "Download rental agreement"
4. Verify a PDF or document opens (generic agreement or previously accepted version)
5. Verify the user is not shown an error like "Document not found" (fallback URL is used)

**Expected Results**:

- ✅ "Download rental agreement" remains available (or is enabled) when no generated document exists
- ✅ Clicking it opens a document (generic agreement or fallback), not a broken link or error
- ✅ User receives clear experience; no blocking error for missing generated PDF
- ✅ Once a generated document exists (e.g. after worker runs), subsequent downloads may return the filled PDF (implementation may cache or prefer generated when available)

**Test Data**:

- Approved rental without a row in rental_agreement_documents, OR rental approved seconds ago before worker has run
- legal_documents has current per_rental_agreement URL

**Priority**: High  
**Requirement Reference**: Requirement 5.3, 7.2 - Fallback when no generated document

---

### Scenario 7: Unauthorized User Cannot Access Rental Agreement

**User Story**: As a system, I want to ensure only the renter and owner of a rental can access that rental's agreement.

**Preconditions**:

- User A is logged in
- User A is not the renter or owner of a specific rental
- User A attempts to access the rental detail page or the rental agreement URL for that rental

**Test Steps**:

1. Log in as User A (not renter or owner of the target rental)
2. Attempt to navigate to the rental detail page for the target rental (e.g. by URL or link)
3. If the page is accessible, verify "Download rental agreement" is not available or is disabled, OR that accessing the agreement URL directly returns 403/404 or no document
4. If the detail page itself is restricted, verify User A cannot view the rental (e.g. 404 or redirect)

**Expected Results**:

- ✅ User who is not the renter or owner cannot access the rental agreement
- ✅ Rental detail page may be inaccessible (404) or the download action may be hidden/disabled for unauthorized users
- ✅ Direct access to the agreement URL (if ever exposed) does not allow User A to view another user's agreement (e.g. blob URL may be unguessable; or server checks authorization before redirecting)
- ✅ No sensitive data (other user's names, rental details) is exposed to User A

**Test Data**:

- User A (third party)
- Rental where renter is User B and owner is User C

**Priority**: High  
**Requirement Reference**: Requirement 5.4 - Unauthorized access prevention

---

### Scenario 8: Approval Succeeds Even If PDF Generation Fails

**User Story**: As an owner, I want the approval and payment to complete successfully even if the system cannot generate the PDF right now, so that the rental is not blocked.

**Preconditions**:

- Owner is approving a rental request with valid payment
- PDF generation is failing (e.g. worker down, blob storage error, or simulated failure in staging)

**Test Steps**:

1. As owner, submit approval for the rental request (with payment)
2. Wait for the approval request to complete
3. Verify the approval returns success (e.g. 200, success message, rental status updated to approved)
4. Verify the renter and owner receive success notifications (e.g. rental approved, payment succeeded)
5. Optionally, as renter or owner, open the rental detail page and check "Download rental agreement"
6. Verify either: (a) fallback document is available, or (b) download is disabled with a clear message, but the rental itself is approved and usable

**Expected Results**:

- ✅ Approval and payment complete successfully; owner sees success response
- ✅ Approval is not blocked or delayed by PDF generation failure
- ✅ Notifications (e.g. rental approved) are sent
- ✅ Rental is in approved/active state
- ✅ If generation failed, fallback document or graceful handling is available for download (per Scenario 6)
- ✅ Error is logged server-side for support (not necessarily shown to user)

**Test Data**:

- Valid rental request; PDF generation intentionally failing or worker unavailable (staging)

**Priority**: High  
**Requirement Reference**: Requirement 3.4, 7.1 - Generation failure does not block approval

---

### Scenario 9: No PDF Generated at Rental Request Creation

**User Story**: As a system, I want to ensure the filled PDF is only generated at approval, not when the renter submits the request.

**Preconditions**:

- User is logged in as a renter
- User submits a new rental request (with agreement checkbox confirmed)

**Test Steps**:

1. Submit a new rental request with agreement confirmed
2. After success, verify in backend/DB (or via support tooling) that no row exists in rental_agreement_documents for this rental_request_id
3. Verify that a row exists in user_legal_acceptances for this rental_request_id and documentId per_rental_agreement (renter acceptance only)
4. As owner, do not approve yet (or approve in a separate test)
5. Confirm that the filled PDF is only created after owner approval (e.g. after Scenario 3 flow)

**Expected Results**:

- ✅ Submitting a rental request does not create a row in rental_agreement_documents
- ✅ Renter acceptance is recorded in user_legal_acceptances
- ✅ Filled PDF is created only when the owner approves (and payment succeeds) and the worker/internal route runs

**Test Data**:

- New rental request created by renter

**Priority**: High  
**Requirement Reference**: Requirement 3.2 - No generation at request creation

---

## Sign-Off

| Role             | Name | Date | Pass/Fail |
| ---------------- | ---- | ---- | --------- |
| QA / Tester      |      |      |           |
| Product Owner    |      |      |           |
| Development Lead |      |      |           |

**Notes**: Execute scenarios in an environment where PDF generation (Playwright) and blob storage are available. For Scenario 8, simulate failure (e.g. disable worker or blob) to confirm approval still succeeds. Legacy rentals (Scenario 6) may require a rental approved before this feature was deployed.
