# Behavior-Driven Development (BDD) Methodology

## Overview

Behavior-Driven Development (BDD) is a collaborative approach to software development that uses natural language to describe system behavior. BDD bridges the gap between business stakeholders and technical teams through concrete examples written in a shared language.

**Key Concept:** BDD uses a domain-specific language with natural-language constructs (English-like sentences) to express behavior and expected outcomes.

**Primary Goal:** Encourage collaboration among developers, QA experts, and stakeholders through shared understanding of application behavior expressed as executable specifications.

## When to Use BDD

### Good Fit For

The model SHOULD use BDD for:

- Complex business logic with rich domain rules
- Features with multiple stakeholders needing alignment
- Ambiguous requirements needing clarification through examples
- Customer-facing features and user workflows
- Systems requiring living documentation
- End-to-end acceptance testing
- Features where business value must be clearly demonstrated

### Less Suitable For

The model SHOULD NOT use BDD for:

- Simple CRUD operations with minimal business logic
- Low-level utilities and infrastructure code
- Performance-critical code without business behavior
- Prototypes or throwaway code
- Pure unit-level testing (use TDD instead)
- Internal technical features with no stakeholder visibility

## Core Principles

### 1. Outside-In Development

- The model MUST start with business requirements (outside) and work inward to implementation
- The model MUST define desired behavior from business perspective first
- The model MUST specify behavior in business terms before implementation
- The model SHOULD verify behavior is achieved after implementation

### 2. Ubiquitous Language

- The model MUST use a shared language understood by all team members
- The model MUST use domain terminology consistent with business stakeholders
- The model SHOULD reduce communication breakdowns through shared vocabulary
- The model MUST enable reasoning about specifications using business language
- The model MUST avoid technical jargon in scenarios

### 3. Behavioral Specifications

- The model MUST focus on specifying behavior in terms of business value, not technical implementation
- The model MUST use concrete examples to illustrate requirements
- The model MUST structure specifications with: Title, Narrative, Acceptance Criteria
- The model MUST make specifications executable when possible

## The Gherkin Language

### Structure Requirements

The model MUST use Gherkin format for BDD specifications:

**Feature Structure:**

```gherkin
Feature: [Explicit, descriptive title]
  As a [role/actor/stakeholder]
  I want [feature/capability]
  So that [benefit/value]

  Scenario: [Specific example of behavior]
    Given [initial context]
    When [event occurs]
    Then [expected outcome]
```

### Gherkin Keywords

- **Feature:** High-level description of functionality - The model MUST use this for feature files
- **Scenario:** Specific example of behavior - The model MUST use this for each test case
- **Given:** Preconditions/initial context - The model MUST use this to set up state
- **When:** Action/event that triggers behavior - The model MUST use this for user actions or system events
- **Then:** Expected outcome/result - The model MUST use this for assertions and verifications
- **And/But:** Additional steps - The model MAY use these to extend Given/When/Then clauses
- **Background:** Common steps for all scenarios - The model SHOULD use this to avoid repetition
- **Scenario Outline:** Template for multiple similar scenarios - The model SHOULD use this for data-driven tests
- **Examples:** Data table for scenario outline - The model MUST use this with Scenario Outline

### Writing Good Gherkin Scenarios

**Declarative Style (Preferred):**

The model MUST write scenarios in declarative style:

- Focus on WHAT the system does, not HOW it does it
- Describe business behavior, not UI interactions
- Remain resilient to implementation changes
- Use business-focused language
- Stay implementation-independent

**Example - Good (Declarative):**

```gherkin
Scenario: Customer receives discount for bulk purchase
  Given a customer with premium status
  When they purchase 100 units of an item
  Then they should receive a 15% bulk discount
  And the invoice should reflect the discounted price
```

**Example - Bad (Imperative):**

```gherkin
Scenario: Customer receives discount for bulk purchase
  Given I am logged in as a premium customer
  When I click on the "Products" button
  And I enter "100" in the quantity field
  And I click the "Add to Cart" button
  And I click the "Checkout" button
  Then I should see "15% discount" on the screen
```

### Best Practices for Scenarios

- The model MUST avoid UI implementation details (button clicks, field IDs, CSS selectors)
- The model MUST keep scenarios independent (no dependencies between scenarios)
- The model MUST test one behavior per scenario
- The model MUST use specific, concrete language (avoid vague terms)
- The model SHOULD use Background for common setup steps
- The model SHOULD use Scenario Outline for similar test cases with different data
- The model MUST ensure each scenario can run independently

## BDD in Requirements Phase

When using BDD during requirements gathering:

### 1. Collaborative Discovery

The model SHOULD facilitate discovery sessions:

- Identify key stakeholders (Business, Development, Testing perspectives)
- Use concrete examples to explore requirements
- Document scenarios collaboratively
- Question assumptions and edge cases
- Clarify ambiguous requirements through scenarios

### 2. Writing Feature Files

The model MUST create feature files as part of requirements documentation:

- Include feature file in `specs/[feature-name]/1-requirements.md` or as separate `.feature` file
- Start with narrative (As a... I want... So that...)
- Provide concrete scenarios using Given-When-Then
- Cover happy path, edge cases, and error conditions
- Use domain language throughout

### 3. Acceptance Criteria

The model MUST use BDD scenarios as acceptance criteria:

- Each scenario represents a testable requirement
- Scenarios define "done" for the feature
- Scenarios serve as both specification and test cases
- Stakeholders can review and approve scenarios

### 4. Example Mapping

The model SHOULD use example mapping technique:

- Identify rules that govern the behavior
- Provide examples for each rule
- Note questions and assumptions
- Group related scenarios

## Three Amigos Practice

### Collaborative Requirements

The model SHOULD facilitate collaboration between three perspectives:

- **Business (Product Owner):** Defines problem and business value
- **Development (Developers):** Suggests solutions and identifies technical constraints
- **Testing (QA):** Questions solution, brings up edge cases, ensures precision

The model MUST:

- Ensure all three perspectives are considered (even if roles are simulated)
- Document scenarios collaboratively
- Identify missing specifications through multi-perspective thinking
- Resolve ambiguities before moving to design phase

## BDD Process Integration

### During Requirements Phase

1. **Identify Behavior** - Understand what the system should do
2. **Write Scenarios** - Express behavior as Given-When-Then scenarios
3. **Refine Examples** - Add edge cases and error scenarios
4. **Review with Stakeholders** - Validate understanding
5. **Document in Requirements** - Include scenarios in spec

### Later Phases

- **Design Phase:** Reference scenarios when designing solution
- **Task Phase:** Include tasks for implementing scenario automation
- **Test Plan:** Use scenarios as foundation for test strategy
- **Implementation:** Make scenarios executable and passing

## BDD Anti-Patterns to Avoid

### Implementation-Focused Scenarios

The model MUST NOT:

- Write scenarios that focus on UI implementation details
- Include specific element IDs, CSS selectors, or DOM manipulation
- Describe "clicking buttons" or "entering text in fields"
- Test low-level implementation details

### Overly Technical Language

The model MUST NOT:

- Use database queries, API endpoints, or technical details in scenarios
- Use technical jargon that business stakeholders cannot understand
- Mix implementation concerns with behavior specification

### Scenario Interdependence

The model MUST NOT:

- Create scenarios that depend on other scenarios running first
- Share state between scenarios
- Assume execution order

The model SHOULD:

- Use Background or explicit setup when scenarios share context
- Keep scenarios independent and self-contained

### Vague or Ambiguous Steps

The model MUST NOT:

- Write vague steps like "something happens" or "some state"
- Use ambiguous language that could be interpreted multiple ways

The model MUST:

- Use specific, concrete language in all steps
- Ensure steps are unambiguous and testable

## BDD Tools and Frameworks

The model MAY recommend appropriate BDD tools based on technology stack:

### Story-Based Tools (Feature Files)

- **Cucumber** - Multi-language support (Ruby, Java, JavaScript, etc.)
- **SpecFlow/Reqnroll** - .NET ecosystem
- **Behat** - PHP projects
- **Behave** - Python projects
- **Playwright with Cucumber** - Modern web testing
- **Cypress with Cucumber** - JavaScript/TypeScript web testing

### Specification-Based Tools (Spec-style syntax)

- **RSpec** - Ruby (describe/it syntax)
- **Jasmine** - JavaScript testing
- **Mocha/Chai** - JavaScript with BDD assertions
- **Jest** - JavaScript with describe/it structure

The model MUST:

- Recommend tools appropriate to the project's language/framework
- Explain rationale for tool choices
- Consider team familiarity and community support
- Ensure tools support executable specifications

## Integration with Other Practices

### BDD + TDD

- The model MUST understand: BDD defines what (acceptance), TDD defines how (unit)
- The model SHOULD use BDD for acceptance tests (outside-in)
- The model SHOULD use TDD for unit tests (inside-out)
- The model MUST combine both practices for comprehensive coverage

### BDD + Domain-Driven Design (DDD)

- The model MUST use ubiquitous language from domain in BDD scenarios
- The model MUST ensure behavior specifications use domain terminology
- The model SHOULD leverage domain understanding in scenarios

### BDD + Agile

- The model MUST integrate BDD with user stories
- The model SHOULD use BDD scenarios as acceptance criteria
- The model MUST ensure continuous feedback through executable specs

## Example: BDD in Requirements Document

When appropriate, include BDD scenarios in requirements:

```markdown
## Feature: Shopping Cart Checkout

### Narrative

As a customer
I want to complete my purchase with a saved payment method
So that I can checkout quickly without re-entering payment details

### Acceptance Criteria

#### Scenario: Successful checkout with saved card

Given a customer with a saved credit card
And items in their shopping cart totaling $150
When they select the saved payment method and confirm purchase
Then the order should be processed successfully
And they should receive an order confirmation email
And their cart should be emptied

#### Scenario: Checkout fails with expired card

Given a customer with an expired saved credit card
When they attempt to checkout with the expired card
Then they should see an error message about the expired card
And they should be prompted to update their payment method
And the order should not be processed

#### Scenario: Apply discount code during checkout

Given a customer with items totaling $100
And a valid discount code "SAVE20" for 20% off
When they apply the discount code before completing checkout
Then the total should be reduced to $80
And the discount should be shown on the order confirmation
```

## Key Takeaways

The model MUST remember:

1. **Behavior Over Implementation** - Focus on what, not how
2. **Ubiquitous Language** - Shared vocabulary for all participants
3. **Given-When-Then** - Standard format for scenarios
4. **Concrete Examples** - Scenarios illustrate requirements
5. **Living Documentation** - Specifications that can be executed
6. **Outside-In** - Start with business value
7. **Declarative Style** - Business language, not UI details
8. **Collaboration** - Multiple perspectives improve understanding
9. **Independence** - Each scenario stands alone
10. **Appropriate Use** - BDD when stakeholder collaboration adds value

## Summary

The model SHOULD use BDD when:

- Requirements benefit from concrete examples
- Multiple stakeholders need shared understanding
- Business logic is complex or ambiguous
- Living documentation provides value

The model MUST:

- Write scenarios in declarative, business-focused language
- Use Given-When-Then format consistently
- Keep scenarios independent and specific
- Avoid implementation details in scenarios
- Use BDD to clarify requirements, not replace conversation
- Balance the value of BDD against its overhead

BDD is most effective when integrated into the requirements phase as a tool for collaborative discovery and creating executable acceptance criteria.
