---
name: Combine Prohibited Items and Listing Content Rules
overview: Merge the two separate legal documents (Prohibited Items List and Listing Content Rules) into a single combined document titled "Prohibited Items and Listing Content Policy". This involves updating constants, form references, action handlers, tests, and PDF mappings while maintaining backward compatibility with existing database records.
todos:
  - id: update-constants
    content: Add new PROHIBITED_ITEMS_AND_LISTING_CONTENT document ID and metadata to legal-documents.ts
    status: completed
  - id: update-listing-form
    content: Replace LISTING_CONTENT_RULES with new document ID in legal-document-acknowledgments.tsx (PDF map, summaries, and document IDs array)
    status: completed
    dependencies:
      - update-constants
  - id: update-listing-action
    content: Update create-listing.ts to record acceptance of the new combined document instead of LISTING_CONTENT_RULES
    status: completed
    dependencies:
      - update-constants
  - id: update-tests
    content: Update all test files to use the new document ID instead of LISTING_CONTENT_RULES
    status: completed
    dependencies:
      - update-constants
      - update-listing-form
      - update-listing-action
---

# Combine Prohibited Items and Listing Content Rules into Single Document

## Overview

Merge "Prohibited Items List" and "Listing Content Rules" into a single document "Prohibited Items and Listing Content Policy". The new document will replace `LISTING_CONTENT_RULES` in active use, while maintaining backward compatibility for existing database records.

## Implementation Steps

### 1. Update Legal Document Constants

**File:** [`src/constants/legal-documents.ts`](src/constants/legal-documents.ts)

- Add new document ID constant: `PROHIBITED_ITEMS_AND_LISTING_CONTENT: "prohibited_items_and_listing_content"`
- Update `LEGAL_DOCUMENT_METADATA` to include the new combined document:
- Name: "Prohibited Items and Listing Content Policy"
- Category: `LEGAL_DOCUMENT_CATEGORIES.GOVERNANCE`
- Keep `PROHIBITED_ITEMS` and `LISTING_CONTENT_RULES` in constants for backward compatibility with existing database records
- Optionally mark old documents as deprecated in metadata (or remove from metadata if they shouldn't appear in admin UI)

### 2. Update Listing Form Document Acknowledgments

**File:** [`src/features/listings/components/listing-form/legal-document-acknowledgments.tsx`](src/features/listings/components/listing-form/legal-document-acknowledgments.tsx)

- Replace `LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES` with `LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT` in:
- `DOCUMENT_PDF_MAP` (update path to new PDF: `/documents/prohibited-items-and-listing-content-policy.pdf`)
- `DOCUMENT_SUMMARIES` (update summary text to reflect combined document)
- `DOCUMENT_IDS` array (replace the old ID with the new one)

### 3. Update Listing Creation Action

**File:** [`src/features/listings/actions/create-listing.ts`](src/features/listings/actions/create-listing.ts)

- Replace `LEGAL_DOCUMENT_IDS.LISTING_CONTENT_RULES` with `LEGAL_DOCUMENT_IDS.PROHIBITED_ITEMS_AND_LISTING_CONTENT` in the document acceptance recording logic (around line 167-181)
- Update the comment "Record acceptance for each of the 4 owner policy documents" if the count changes

### 4. Update Tests

**File:** [`src/features/listings/actions/__tests__/create-listing.test.ts`](src/features/listings/actions/__tests__/create-listing.test.ts)

- Update `mockOwnerDocuments` to use `PROHIBITED_ITEMS_AND_LISTING_CONTENT` instead of `LISTING_CONTENT_RULES`
- Update test assertions that verify `recordAcceptance` calls to expect the new document ID
- Update any test expectations that reference the old document name

**File:** [`src/features/listings/components/listing-form/__tests__/legal-document-acknowledgments.test.tsx`](src/features/listings/components/listing-form/__tests__/legal-document-acknowledgments.test.tsx)

- Update any test assertions that check for `LISTING_CONTENT_RULES` to use the new document ID
- Update PDF path assertions if they reference the old PDF filename

### 5. Admin Legal Page

**File:** [`src/app/admin/dashboard/legal/page.tsx`](src/app/admin/dashboard/legal/page.tsx)

- No code changes needed - the page dynamically displays all documents from `LEGAL_DOCUMENT_METADATA`
- The new combined document will automatically appear in the Governance category
- Old documents (if kept in metadata) will also appear for historical reference

### 6. PDF File Handling

**Manual Step Required:**

- Create the new combined PDF document: `prohibited-items-and-listing-content-policy.pdf`
- Place it in `public/documents/` directory
- Upload the document via the admin interface at `/admin/dashboard/legal` to register it in the database

## Backward Compatibility Considerations

- **Database Records:** Existing `user_legal_acceptances` records will continue to reference the old document IDs (`prohibited_items`, `listing_content_rules`). This is intentional for audit trail purposes.
- **Old Document IDs:** Keep `PROHIBITED_ITEMS` and `LISTING_CONTENT_RULES` in `LEGAL_DOCUMENT_IDS` constant to prevent TypeScript errors and maintain references to historical data.
- **Old PDFs:** The old PDF files (`prohibited-items-list.pdf`, `ip-listing-content-rules.pdf`) can remain in `public/documents/` for historical reference but will no longer be actively referenced in the code.

## Testing Checklist

- [ ] Listing form displays the new combined document in acknowledgments section
- [ ] Listing creation successfully records acceptance of the new document
- [ ] Admin legal page displays the new combined document
- [ ] Tests pass with updated document references
- [ ] PDF file is accessible at the new path
- [ ] Old document IDs still exist in constants (for backward compatibility)

## Notes

- The `PROHIBITED_ITEMS` document ID was defined but never actively used in the listing form or creation action, so removing its active references has no impact
- The summary text for the combined document should reflect that it covers both prohibited items and listing content rules
- Consider updating the document summary to: "This policy outlines prohibited items that cannot be listed on the platform and the rules governing listing content, including accurate descriptions and intellectual property requirements."
