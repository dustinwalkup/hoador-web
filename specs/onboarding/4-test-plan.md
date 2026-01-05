# Test Plan: Onboarding

## Requirements Traceability

This test plan covers user onboarding functionality including onboarding flow, profile setup, image upload, and validation. Tests verify onboarding completion, data validation, and user experience requirements.

### Core Onboarding Requirements

**Test Coverage**:

- Unit tests: Server actions, form validation, image upload
- Integration tests: Onboarding flow, profile creation
- E2E tests: Complete onboarding workflows
- BDD scenarios: Onboarding acceptance criteria

## Test Types

### Unit Tests

#### Server Actions

- [ ] `onboardingAction` - Complete onboarding via form submission
  - Happy path: Valid FormData completes onboarding
  - Error: Invalid FormData returns error result
  - Error: Missing required fields returns error
  - Integration: Verifies revalidatePath called

#### Components

- [ ] `OnboardingForm` - Onboarding form component
  - Rendering: All onboarding fields
  - User interaction: Form submission completes onboarding
  - Validation: Shows error for invalid inputs
  - Loading state: Shows loading during submission
  - Multi-step: Handles multi-step form navigation

- [ ] `ProfileImageUpload` - Profile image upload component
  - Rendering: Image upload area, preview
  - User interaction: Image selection, upload
  - Validation: Image type and size validation
  - Loading state: Shows upload progress

#### Utilities

- [ ] `validation.ts` - Onboarding validation schema
  - Valid: Accepts valid onboarding data
  - Invalid: Rejects invalid data with specific error messages
  - Edge cases: Boundary values, required fields

### Integration Tests

- [ ] **Onboarding Flow: Form → Action → Profile Creation**
  - Complete flow: User completes onboarding → action validates → profile created → user redirected

### E2E Tests

- [ ] **Complete Onboarding Workflow**
  - New user signs up
  - User redirected to onboarding
  - User fills out onboarding form
  - User uploads profile image
  - User submits form
  - Verifies onboarding completed
  - Verifies user redirected to dashboard

## Coverage Goals

- **Server Actions**: 85%+
- **React Components**: 80%+ (exceeds 75% threshold)
- **Utilities**: 90%+
- **Overall**: > 85% lines (meets 80% threshold)

## Existing Test Coverage

- None

## Missing Test Coverage

- All server actions (no tests)
- All components (no tests)
- Integration tests (none exist)
- E2E tests (none exist)

## BDD Scenarios

```gherkin
Feature: Complete Onboarding
  As a newly registered user
  I want to complete my profile during onboarding
  So that I can use all platform features

  Background:
    Given I have signed up for an account
    And I have verified my email
    And I am redirected to the onboarding page

  Scenario: Successfully complete onboarding with all fields
    Given I am on the onboarding page
    When I fill out my first name, last name, and phone number
    And I enter my address
    And I upload a profile image
    And I agree to the terms of service
    And I submit the form
    Then my profile should be completed
    And my user status should be "active"
    And I should be redirected to the dashboard

  Scenario: Complete onboarding without optional fields
    Given I am on the onboarding page
    When I fill out only required fields
    And I agree to the terms of service
    And I submit the form
    Then my profile should be completed
    And I should be redirected to the dashboard

  Scenario: Onboarding fails with invalid data
    Given I am on the onboarding page
    When I enter invalid phone number
    And I submit the form
    Then I should see a validation error
    And I should remain on the onboarding page

  Scenario: Onboarding fails when terms not agreed
    Given I am on the onboarding page
    When I fill out all required fields
    And I do not agree to the terms of service
    And I submit the form
    Then I should see a validation error
    And I should remain on the onboarding page

  Scenario: Onboarding completes even if address update fails
    Given I am on the onboarding page
    When I fill out all required fields including address
    And I submit the form
    And the address update fails
    Then my profile should still be completed
    And I should be redirected to the dashboard
```
