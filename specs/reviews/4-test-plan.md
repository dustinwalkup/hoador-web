# Test Plan: Reviews

## Requirements Traceability

This test plan covers review functionality including creation, display, rating system, and review notifications. Tests verify review submission, rating validation, and user experience requirements.

### Core Review Requirements

**Test Coverage**:

- Unit tests: ReviewDAL methods, server actions, rating validation
- Integration tests: Review creation flow, rating calculation
- E2E tests: Complete review workflows
- BDD scenarios: Review acceptance criteria

## Test Types

### Unit Tests

#### DAL Methods

- [ ] `ReviewDAL.create` - Create review
  - Happy path: Review created successfully
  - Error: Invalid data throws ValidationError
  - Error: User cannot review self throws ValidationError
  - Error: Duplicate review throws ValidationError
  - Error: Rental not completed throws ValidationError
  - Edge case: Rating validation (1-5 stars)

- [ ] `ReviewDAL.getByRentalId` - Get reviews for rental
  - Happy path: Returns reviews for rental
  - Edge case: Empty result set
  - Edge case: Multiple reviews

- [ ] `ReviewDAL.getByUserId` - Get reviews for user
  - Happy path: Returns reviews for user
  - Edge case: Empty result set
  - Edge case: Average rating calculation

- [ ] `ReviewDAL.canLeaveReview` - Check if user can leave review
  - Happy path: Returns true if eligible
  - Edge case: Returns false if already reviewed
  - Edge case: Returns false if rental not completed

#### Server Actions

- [ ] `createReview` - Create review via form submission
  - Happy path: Valid FormData creates review and revalidates path
  - Error: Invalid FormData returns error result
  - Error: DAL error returns user-friendly error message
  - Integration: Verifies revalidatePath called
  - Integration: Verifies notification sent

#### Components

- [ ] `LeaveReviewModal` - Modal for leaving review
  - Rendering: Rating selector, comment input, submit button
  - User interaction: Rating selection, comment input, form submission
  - Validation: Shows error for invalid rating
  - Loading state: Shows loading during submission
  - Success state: Closes modal and shows success message

- [ ] `ReviewerAvatar` - Reviewer avatar display
  - Rendering: User avatar, name, rating
  - Edge case: Missing avatar shows placeholder

#### Utilities

- [ ] `review-schema.ts` - Zod validation schema
  - Valid: Accepts valid review data
  - Invalid: Rejects invalid data with specific error messages
  - Rating validation: 1-5 stars required
  - Comment validation: Optional but validated if provided

### Integration Tests

- [ ] **Review Creation Flow: Form → Action → DAL → Database**
  - Complete flow: User submits review → action validates → DAL creates review → database stores review
  - Rating calculation: Average rating updated
  - Notification: Review created → notification sent

### E2E Tests

- [ ] **Complete Review Workflow**
  - User completes rental
  - User views rental details
  - User clicks "Leave Review"
  - User selects rating and writes comment
  - User submits review
  - Verifies review appears
  - Verifies rating updated

### BDD Scenarios

```gherkin
Feature: Leave Review
  As a user
  I want to leave a review
  So that I can share my experience

  Background:
    Given I am logged in as a user
    And I have completed a rental

  Scenario: Successfully leave review
    Given I am viewing the completed rental
    When I click "Leave Review"
    And I select a rating
    And I write a comment
    And I submit the review
    Then the review should be created
    And the rating should be updated
    And the owner should receive a notification
```

## Coverage Goals

- **DAL Methods**: 70%+ (exceeds 50% threshold)
- **Server Actions**: 85%+
- **React Components**: 80%+ (exceeds 75% threshold)
- **Utilities**: 90%+
- **Overall**: > 85% lines (meets 80% threshold)

## Existing Test Coverage

- None

## Missing Test Coverage

- All DAL methods (no tests)
- All server actions (no tests)
- All components (no tests)
- Integration tests (none exist)
- E2E tests (none exist)
