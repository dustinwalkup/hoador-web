# EARS Methodology - Spec-Driven Development

## Overview

EARS (Easy Approach to Requirements Syntax) is a structured methodology for developing software through specification-first development. This process ensures clear communication, thorough planning, and quality outcomes.

## Core Principle

**Never skip ahead.** Each phase builds on the previous one. Wait for explicit approval before proceeding to the next phase.

## The Five Phases

### Phase 1: Requirements

**Goal**: Transform vague ideas into clear, actionable requirements.

**AI Instructions**:

- The model MUST create `specs/[feature-name]/1-requirements.md` if it doesn't already exist
- The model MUST generate an initial version of the requirements document based on the user's input WITHOUT asking sequential questions first
- The model MUST format requirements document with:
  - Clear introduction section summarizing the feature
  - Hierarchical numbered list of requirements
  - Each requirement containing:
    - User story: "As a [role], I want [feature], so that [benefit]"
    - Numbered list of acceptance criteria in EARS format
- Take initial input (even if vague like "make a thing that does stuff")
- Document functional and non-functional requirements
- Use clear, testable language
- Identify any assumptions or constraints
- Consider edge cases, user experience, technical constraints, and success criteria
- Create requirements in EARS format:
  - Ubiquitous: "The system shall..."
  - Event-driven: "WHEN [trigger] THEN [system] SHALL [response]"
  - State-driven: "WHILE [state], the system shall..."
  - Optional: "WHERE [condition], the system shall..."
  - Conditional: "IF [precondition] THEN [system] SHALL [response]"

**BDD Integration** (when appropriate):

- Consider using BDD scenarios to clarify complex business logic
- Write concrete examples using Given-When-Then format
- See `AI-bdd-methodology.md` for detailed BDD guidelines
- Include feature narratives and scenarios as acceptance criteria
- Use BDD for collaborative requirements discovery
- When to use BDD:
  - Complex domain logic with multiple stakeholders
  - Ambiguous requirements needing concrete examples
  - Features requiring living documentation
  - Customer-facing workflows with clear business value

**Document Format Example**:

```markdown
# Requirements Document

## Introduction

[Brief summary of the feature and its purpose]

## Requirements

### Requirement 1: [Requirement Name]

**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria

1. WHEN [event] THEN [system] SHALL [response]
2. IF [precondition] THEN [system] SHALL [response]
3. WHERE [optional condition], the system shall [response]

### Requirement 2: [Requirement Name]

**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria

1. WHEN [event] AND [condition] THEN [system] SHALL [response]
2. The system shall [ubiquitous requirement]
```

**Output**: `specs/[feature-name]/1-requirements.md`

**Approval Gate**:

- The model MUST ask: "Do the requirements look good? If so, we can move on to the design."
- The model MUST make modifications if the user requests changes or does not explicitly approve
- The model MUST ask for explicit approval after every iteration of edits
- The model MUST NOT proceed to Design until receiving clear approval ("yes", "approved", "looks good", etc.)
- The model MUST continue the feedback-revision cycle until explicit approval is received
- The model SHOULD suggest specific areas where requirements might need clarification
- The model MAY ask targeted questions about specific aspects needing clarification

---

### Phase 2: Design

**Goal**: Create a technical design that satisfies the requirements.

**AI Instructions**:

- The model MUST create `specs/[feature-name]/2-design.md` if it doesn't already exist
- The model MUST ensure requirements document exists and is approved before proceeding
- Review approved requirements thoroughly
- The model MUST identify areas where research is needed based on feature requirements
- The model MUST conduct necessary research to inform design decisions
- The model SHOULD summarize key research findings that inform the design
- The model SHOULD cite sources and include relevant links for research
- Propose architectural approach
- Identify:
  - Key components/modules
  - Data models and schemas
  - API contracts or interfaces
  - External dependencies
  - Technology choices (with rationale)
- Consider:
  - Scalability implications
  - Security considerations
  - Performance requirements
  - Maintainability
- Create diagrams (Mermaid or otherwise) or pseudocode as needed
- Map design elements back to requirements
- The model MUST include the following sections:
  - Overview
  - Architecture
  - Components and Interfaces
  - Data Models
  - Error Handling
  - Testing Strategy
- The model SHOULD include diagrams or visual representations when appropriate
- The model SHOULD highlight design decisions and their rationales
- The model MAY ask the user for input on specific technical decisions

**Research Guidance**:

- The model MUST conduct research during design when:
  - Technology choices need validation
  - Best practices are unclear
  - Integration patterns are needed
  - Performance characteristics are unknown
  - Security implications need investigation
- The model SHOULD build up context through research findings
- The model SHOULD NOT create separate research files
- The model MUST incorporate research findings directly into the design document
- The model SHOULD document why certain approaches were chosen based on research

**Output**: `specs/[feature-name]/2-design.md`

**Approval Gate**:

- The model MUST ask: "Does the design look good? If so, we can move on to the task list."
- The model MUST make modifications if the user requests changes or does not explicitly approve
- The model MUST ask for explicit approval after every iteration of edits
- The model MUST NOT proceed to Tasks until receiving clear approval ("yes", "approved", "looks good", etc.)
- The model MUST continue the feedback-revision cycle until explicit approval is received
- The model MUST incorporate all user feedback before proceeding
- The model MAY offer to return to Requirements if gaps are identified during design

---

### Phase 3: Task List

**Goal**: Break down the design into implementable tasks.

**AI Instructions**:

- The model MUST create `specs/[feature-name]/3-tasks.md` if it doesn't already exist
- The model MUST ensure design document exists and is approved before proceeding
- The model MUST return to Design if user indicates changes are needed to design
- The model MUST return to Requirements if user indicates additional requirements are needed
- Convert the design into actionable implementation tasks
- Prioritize best practices, incremental progress, and early testing
- Ensure no big jumps in complexity at any stage
- Decompose design into discrete, actionable tasks
- Order tasks by dependencies
- Estimate relative complexity (S/M/L or story points)
- The model MUST ensure each step builds incrementally on previous steps
- Include setup tasks:
  - Development environment configuration
  - Tool installation (linters, formatters, testing frameworks)
  - Dependency management
  - CI/CD setup if applicable
- Ensure each task is:
  - Specific and clear
  - Testable/verifiable
  - Appropriately sized (can be completed in one session)
  - Actionable (involves writing, modifying, or testing code)
  - References specific requirements from requirements document
- Group related tasks
- Identify tasks that can be parallelized
- The model MUST focus ONLY on tasks that involve writing, modifying, or testing code
- The model MUST NOT include tasks that cannot be completed through coding:
  - User acceptance testing or feedback gathering
  - Deployment to production/staging environments
  - Performance metrics gathering or analysis
  - User training or documentation creation
  - Business process or organizational changes
  - Marketing or communication activities
- The model MUST format as numbered checkbox list with maximum two levels:
  - Top-level items (epics) only when needed
  - Sub-tasks numbered with decimal notation (1.1, 1.2, 2.1)
  - Each item must be a checkbox
  - Simple structure preferred
- The model MUST ensure each task includes:
  - Clear objective as task description
  - Additional information as sub-bullets
  - Specific requirement references
- The model SHOULD prioritize test-driven development where appropriate
- The model MUST ensure all requirements are covered by implementation tasks
- The model MUST ensure no hanging or orphaned code that isn't integrated

**Task Format Example**:

```markdown
# Implementation Tasks

- [ ] 1. Set up project structure and core interfaces
  - Create directory structure for models, services, repositories
  - Define interfaces that establish system boundaries
  - _Requirements: 1.1, 1.2_

- [ ] 2. Implement data models and validation
  - [ ] 2.1 Create core data model interfaces and types
    - Write interfaces for all data models
    - Implement validation functions for data integrity
    - _Requirements: 2.1, 3.3, 1.2_
  - [ ] 2.2 Implement User model with validation
    - Write User class with validation methods
    - Create unit tests for User model validation
    - _Requirements: 1.2_

- [ ] 3. Create storage mechanism
  - [ ] 3.1 Implement database connection utilities
    - Write connection management code
    - Create error handling for database operations
    - _Requirements: 2.1, 3.3_
```

**Output**: `specs/[feature-name]/3-tasks.md`

**Approval Gate**:

- The model MUST ask: "Do the tasks look good? If so, we can move on to the test plan."
- The model MUST make modifications if the user requests changes or does not explicitly approve
- The model MUST ask for explicit approval after every iteration of edits
- The model MUST NOT proceed to Test Plan until receiving clear approval ("yes", "approved", "looks good", etc.)
- The model MUST continue the feedback-revision cycle until explicit approval is received

---

### Phase 4: Test Plan

**Goal**: Define how to verify the implementation meets requirements.

**AI Instructions**:

- Map tests back to requirements
- Define test types needed:
  - Unit tests
  - Integration tests
  - End-to-end tests
  - Manual testing scenarios
- Specify:
  - Test framework/tools to use
  - Coverage goals
  - Key test cases (happy path, edge cases, error conditions)
  - Performance benchmarks if applicable
  - Security testing considerations
- Include:
  - Test data requirements
  - Mock/stub strategies
  - Acceptance criteria for each requirement
- Consider:
  - Automated vs manual testing
  - Testing environment needs

**TDD Integration** (when appropriate):

- Specify TDD approach for unit-level tests
- See `AI-tdd-methodology.md` for detailed TDD guidelines
- Define Red-Green-Refactor strategy for implementation
- Identify test scenarios for TDD cycles
- Plan test isolation and mocking strategies
- When to use TDD:
  - Complex business logic requiring high reliability
  - Long-lived code needing maintainability
  - Core algorithms and data transformations
  - Features with clear, testable requirements

**Output**: `specs/[feature-name]/4-test-plan.md`

**Approval Gate**:

- The model MUST ask: "Does the test plan look good? If so, we can move on to implementation notes."
- The model MUST make modifications if the user requests changes or does not explicitly approve
- The model MUST ask for explicit approval after every iteration of edits
- The model MUST NOT proceed to Implementation Notes until receiving clear approval ("yes", "approved", "looks good", etc.)
- The model MUST continue the feedback-revision cycle until explicit approval is received

---

### Phase 5: Implementation Notes

**Goal**: Document implementation decisions and provide guidance for development.

**AI Instructions**:

- Summarize the complete specification
- Highlight critical implementation details
- Note any deviations or decisions made during earlier phases
- Document:
  - Coding standards to apply (reference AI-coding-standards.md)
  - TDD approach if applicable (reference AI-tdd-methodology.md)
  - File structure
  - Naming conventions for this feature
  - Error handling approach
  - Logging/monitoring strategy
- Create implementation checklist
- Reference relevant tasks and test plans
- Include any "gotchas" or known challenges
- If using TDD:
  - Note which components should be test-driven
  - Remind to follow Red-Green-Refactor cycle
  - Reference test scenarios from test plan

**Output**: `specs/[feature-name]/5-implementation-notes.md`

**Approval Gate**:

- The model MUST ask: "Do the implementation notes look good? If approved, implementation can begin."
- The model MUST make modifications if the user requests changes or does not explicitly approve
- The model MUST ask for explicit approval after every iteration of edits
- The model MUST NOT consider the specification process complete until receiving clear approval ("yes", "approved", "looks good", etc.)
- The model MUST continue the feedback-revision cycle until explicit approval is received
- After approval, the model MUST inform user that specifications are complete and implementation can begin

---

## Working with EARS

### Starting a New Feature

1. User provides initial requirements (can be rough/informal)
2. AI creates `specs/[feature-name]/` directory
3. AI begins Phase 1, asking questions to clarify requirements

### Phase Progression

- AI completes current phase document
- AI explicitly states: "Phase [N] complete. Please review and approve to proceed to Phase [N+1]."
- User reviews and either:
  - Approves: "Approved, move to next phase"
  - Requests changes: Specific feedback for revision
  - Rejects: Back to previous phase or restart

### Iterating on Specifications

- Specs are living documents
- Can revisit earlier phases if new information emerges
- Always note when/why specs are updated
- Maintain spec version history in git

### Using Specs During Implementation

- Specs provide context for all development work
- Reference specific requirements when implementing
- Update implementation notes with any discovered issues
- Link code commits to spec sections when possible

## Best Practices

- **Be thorough in early phases** - Time spent in requirements and design saves time in implementation
- **Ask questions** - AI should ask clarifying questions rather than make assumptions
- **Conduct research when needed** - Research during design phase informs better decisions
- **Trace requirements** - Maintain clear links from requirements → design → tasks → tests → code
- **Stay flexible** - Adapt the process as needed for different types of work
- **Document decisions** - Capture the "why" behind choices made in each phase
- **Seek explicit approval** - Wait for clear confirmation before moving to next phase
- **Iterate as needed** - Revise documents based on feedback until approved

## Troubleshooting

### Requirements Clarification Stalls

If the requirements process is going in circles or not making progress:

- The model SHOULD suggest moving to a different aspect of the requirements
- The model MAY provide examples or options to help user make decisions
- The model SHOULD summarize what has been established and identify specific gaps
- The model MAY suggest conducting research to inform requirements decisions

### Research Limitations

If the model cannot access needed information:

- The model SHOULD document what information is missing
- The model SHOULD suggest alternative approaches based on available information
- The model MAY ask user to provide additional context or documentation
- The model SHOULD continue with available information rather than blocking progress

### Design Complexity

If the design becomes too complex or unwieldy:

- The model SHOULD suggest breaking it down into smaller, more manageable components
- The model SHOULD focus on core functionality first
- The model MAY suggest a phased approach to implementation
- The model SHOULD return to requirements to prioritize features if needed

### Approval Process Issues

If unclear whether user has approved:

- The model MUST ask explicitly for approval
- The model MUST NOT assume silence or partial feedback means approval
- The model SHOULD re-ask for approval if response is ambiguous
- The model MUST wait for explicit confirmation ("yes", "approved", "looks good", "proceed", etc.)
