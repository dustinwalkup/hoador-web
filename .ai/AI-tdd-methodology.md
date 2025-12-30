# Test-Driven Development (TDD) Guidelines

## Overview

Test-Driven Development (TDD) is a software development approach where automated unit-level test cases are written before the production code, then just enough code is written to make the test pass, followed by refactoring.

**Core Principle:** Write tests first, then write code to pass those tests, then refactor.

**Primary Goal:** Improve code quality, design, and maintainability through test-first development.

## When to Use TDD

### Good Fit For

The model SHOULD use TDD for:

- Complex business logic with clear requirements
- Long-lived systems where maintainability is critical
- Code requiring high reliability and confidence
- Algorithms and data transformations
- Domain models with business rules
- Core services and utilities
- API endpoints with defined contracts

### Less Suitable For

The model SHOULD NOT use TDD for:

- Simple CRUD operations with minimal logic
- Prototype or throwaway code
- UI-heavy work (layouts, styling)
- Exploratory coding where requirements are unclear
- Glue code or simple integrations
- Configuration-heavy code

## The TDD Mantra

### Red-Green-Refactor Cycle

The model MUST follow the Red-Green-Refactor cycle:

1. **Red** - Write a failing test
2. **Green** - Make the test pass with minimal code
3. **Refactor** - Improve the code while keeping tests passing

The model MUST:

- Ensure all tests pass after each refactoring step
- NOT skip the Red phase (test must fail first)
- NOT add functionality beyond what the test requires
- Run tests frequently throughout the cycle

## The TDD Cycle

### Six-Step Process

#### 1. List Scenarios for the New Feature

The model MUST:

- Identify expected variants in new behavior before writing code
- List use cases, edge cases, and error conditions
- Ask "what-if" questions to identify scenarios
- Focus on requirements before implementation
- Prioritize scenarios by importance

#### 2. Write a Test for an Item on the List

The model MUST:

- Create an automated test that would pass if the requirement is met
- Write small, focused tests (one thing at a time)
- Use descriptive test names that explain what is being tested
- Follow the AAA pattern (Arrange, Act, Assert)
- Include cleanup when necessary

#### 3. Run All Tests - New Test Should Fail

The model MUST:

- Run all tests to validate the new test fails
- Ensure the test fails for the right reason (not compilation error)
- Verify the test harness is working correctly
- Validate the test is not flawed before proceeding

#### 4. Write the Simplest Code That Passes

The model MUST:

- Implement just enough code to make the test pass
- Follow KISS (Keep It Simple, Stupid) principle
- Follow YAGNI (You Aren't Gonna Need It) principle
- NOT add code beyond tested functionality

The model MAY:

- Write inelegant or hard-coded code initially
- Use "Fake It Till You Make It" approach

#### 5. All Tests Should Now Pass

The model MUST:

- Verify all tests pass after implementation
- Fix failing tests with minimal changes
- NOT add new functionality if tests fail
- Ensure all tests pass before proceeding to refactoring

#### 6. Refactor as Needed

The model MUST:

- Refactor to improve code quality while maintaining functionality
- Ensure all tests continue to pass after each refactor
- NOT change behavior during refactoring

The model SHOULD:

- Improve code structure, naming, and organization
- Extract methods, remove duplication, or simplify conditionals
- Commit after successful refactoring

### Repeat the Cycle

The model MUST:

- Continue the cycle with the next test on the list
- Keep tests small and focused
- NOT test external libraries (unless suspicious behavior)

The model SHOULD:

- Commit often during TDD cycles
- Take breaks between cycles when appropriate

## Development Principles

### KISS (Keep It Simple, Stupid)

The model MUST:

- Write only necessary code
- Avoid over-engineering
- Prefer simple solutions first

The model MAY:

- Add complexity only when tests require it

### YAGNI (You Aren't Gonna Need It)

The model MUST:

- NOT add functionality until needed
- Avoid speculative features
- Focus on current requirements
- Let design emerge from tests

### Fake It Till You Make It

The model MAY:

- Start with simple implementations
- Hard-code values initially

The model SHOULD:

- Generalize as more tests are added
- Let tests drive the design

## Test Structure

### AAA Pattern (Arrange-Act-Assert)

The model MUST structure tests using the AAA pattern:

1. **Arrange (Setup)** - Put system in required state, create test data, configure dependencies
2. **Act (Execution)** - Trigger the behavior being tested, call the method
3. **Assert (Validation)** - Verify results are correct, check return values, verify state changes
4. **Cleanup (Optional)** - Restore pre-test state, release resources

The model MUST:

- Clearly separate these phases in test code
- Ensure assertions are clear and specific

The model SHOULD:

- Keep the Act phase simple (usually one method call)
- Comment or use whitespace to separate AAA sections when helpful

## Best Practices

### Test Code Quality

The model MUST:

- Treat test code like production code
- Write readable and maintainable test code
- Use well-structured and properly named tests
- Ensure tests are reviewed

The model SHOULD:

- Document tests when needed
- Apply same standards as production code

### Test Independence

The model MUST:

- Ensure each test starts from a known state
- NOT create tests that depend on other tests
- NOT create tests that affect other tests
- Ensure tests can run in any order
- Isolate each test

### Test Focus

The model MUST:

- Keep tests focused on one thing at a time
- Write small, focused test cases
- Use clear test names that describe what is tested
- Ensure tests are easy to understand

The model SHOULD:

- Use single assertion when possible
- Name tests that describe behavior, not implementation

### Test Performance

The model MUST:

- Keep tests fast
- Avoid process boundaries in unit tests
- Avoid network connections in unit tests
- Avoid external dependencies in unit tests
- Separate slow integration tests from fast unit tests

The model SHOULD:

- Use test doubles (mocks, stubs, fakes) for dependencies
- Aim for sub-second unit test execution

### Test Maintenance

The model MUST:

- Maintain the test suite regularly
- Remove duplicate test code
- Keep tests up to date
- Fix broken tests immediately

The model SHOULD:

- Refactor tests regularly
- Extract test utilities
- Review test coverage periodically

## Anti-Patterns to Avoid

### Test Dependencies

The model MUST NOT:

- Make tests depend on execution order
- Share state between tests
- Create interdependent tests
- Assume specific test sequence

### Over-Testing

The model MUST NOT:

- Test implementation details
- Create "all-knowing oracles"
- Test external libraries (unless verifying behavior)
- Test simple getters/setters only

### Slow Tests

The model MUST NOT:

- Test precise timing in unit tests
- Test performance in unit tests
- Use real databases in unit tests
- Make network calls in unit tests

### Poor Test Design

The model MUST NOT:

- Hard-code test data in production code
- Create fragile tests
- Write unclear test names
- Ignore failing tests

## Test Doubles

### Types of Test Doubles

- **Stub:** Provides canned responses, no logic, returns predetermined values
- **Mock:** Verifies interactions, records calls, asserts expectations
- **Fake:** Working implementation, simplified version (e.g., in-memory database)
- **Spy:** Wraps real object, records interactions, partial mocking
- **Dummy:** Placeholder object, never actually used, satisfies parameter list

### When to Use Test Doubles

The model SHOULD use test doubles for:

- External dependencies (databases, APIs, file systems)
- Slow operations
- Non-deterministic behavior
- Hard-to-trigger conditions

The model MUST:

- Use test doubles to isolate the unit under test
- Choose appropriate test double type for the scenario

## TDD Variants

### ATDD (Acceptance Test-Driven Development)

The model MAY use ATDD for customer requirements

The model MUST:

- Write tests from customer perspective
- Make tests readable by non-technical stakeholders

The model SHOULD:

- Use ATDD to drive traditional TDD

### BDD (Behavior-Driven Development)

The model MAY use BDD to combine TDD and ATDD

The model MUST:

- Use BDD for behavior-focused testing
- Use shared language for all stakeholders

The model SHOULD:

- Use Given-When-Then syntax for BDD scenarios
- See `AI-bdd-methodology.md` for BDD guidelines

### UTDD (Unit Test-Driven Development)

The model MUST:

- Use UTDD for traditional TDD
- Focus on unit-level tests
- Ensure fast feedback from unit tests

## Integration with Other Practices

### TDD + BDD

The model MUST:

- Use TDD for unit tests (inside-out)
- Use BDD for acceptance tests (outside-in)
- Understand: TDD defines how, BDD defines what

The model SHOULD:

- Combine both practices in development workflow
- Let BDD scenarios drive TDD implementation

### TDD + Refactoring

The model MUST:

- Refactor continuously during the Green phase
- Ensure all tests pass after refactoring
- NOT change behavior during refactoring

The model SHOULD:

- Use tests as a safety net for refactoring
- Improve code quality while maintaining behavior

### TDD + Continuous Integration

The model MUST:

- Run tests automatically in CI/CD pipelines
- Ensure fast feedback from automated tests
- Maintain quality through automated test execution

The model SHOULD:

- Prevent integration issues through continuous testing

## TDD Tools and Frameworks

The model MAY recommend appropriate testing tools based on technology stack:

### Language-Specific Frameworks

**JavaScript/TypeScript:**

- Jest - Full-featured testing framework
- Mocha + Chai - Flexible testing with BDD assertions
- Vitest - Fast Vite-native testing
- Jasmine - Standalone BDD framework

**Python:**

- pytest - Popular testing framework
- unittest - Standard library testing
- nose2 - Extended unittest

**Java:**

- JUnit - Standard Java testing
- TestNG - Advanced testing framework
- Mockito - Mocking framework

**C#/.NET:**

- xUnit - Modern .NET testing
- NUnit - Traditional .NET testing
- MSTest - Microsoft testing framework

**Ruby:**

- RSpec - BDD-style testing
- Minitest - Lightweight testing

**Go:**

- testing - Standard library testing
- testify - Extended assertions

**PHP:**

- PHPUnit - Standard PHP testing

### Mocking Libraries

The model SHOULD recommend mocking tools appropriate to the language:

- JavaScript: Sinon.js, Jest mocks
- Python: unittest.mock, pytest-mock
- Java: Mockito, EasyMock
- C#: Moq, NSubstitute
- Ruby: RSpec mocks

## TDD Workflow for Feature Development

### Step 1: List Scenarios

The model MUST:

- Identify all scenarios before writing code
- List basic cases, edge cases, and error conditions

The model SHOULD:

- Prioritize scenarios by importance
- Start with simplest/most critical scenario

### Step 2: Write Failing Test

The model MUST:

- Write a test for the first scenario
- Ensure the test fails for the right reason
- Use descriptive test names

### Step 3: Make Test Pass

The model MUST:

- Write minimal code to make the test pass
- NOT add unnecessary functionality

The model MAY:

- Use hard-coded values initially

### Step 4: Refactor

The model MUST:

- Refactor to improve code quality
- Ensure all tests still pass

The model SHOULD:

- Improve naming and structure
- Remove duplication

### Step 5: Repeat

The model MUST:

- Continue with the next scenario
- Repeat the cycle until all scenarios are implemented

The model SHOULD:

- Commit after each passing cycle

## Modern TDD Practices

### Cloud-Native TDD

The model MAY:

- Use Testcontainers for integration testing
- Test containerized components in isolation

The model MUST:

- Use test doubles for external services

The model SHOULD:

- Test service contracts and boundaries

### Microservices TDD

The model MUST:

- Test service boundaries and contracts
- Test event-driven interactions

The model SHOULD:

- Use contract testing for microservices
- Isolate services in tests

### Security-Focused TDD

The model MUST:

- Treat security as a functional requirement
- Write tests for security vulnerabilities
- Test input validation and sanitization
- Test access control and authorization

### Performance-Oriented TDD

The model MAY:

- Write performance tests as functional requirements

The model MUST:

- Separate performance tests from unit tests
- Ensure performance tests are deterministic

The model SHOULD:

- Test performance-critical paths

## TDD in EARS Workflow

TDD integrates throughout the EARS process:

### During Requirements Phase

- Identify testable scenarios
- Think about edge cases and error conditions
- Consider how requirements will be verified

### During Design Phase

- Consider testability in architecture decisions
- Design for dependency injection
- Plan test boundaries and isolation strategies

### During Task Phase

- Include TDD tasks: "Write tests for X"
- Break down features into test-driven increments
- Estimate testing effort

### During Test Plan Phase

- Define unit testing approach
- Specify test coverage goals
- Identify test frameworks and tools
- Document testing strategy

### During Implementation Phase

- Follow Red-Green-Refactor cycle
- Write tests before production code
- Keep tests passing throughout development
- Refactor continuously

## Key Takeaways

The model MUST remember:

1. **Red-Green-Refactor** - The core TDD cycle
2. **Tests First** - Write tests before production code
3. **Small Steps** - One test at a time
4. **Simple Code** - Write just enough to pass
5. **Refactor Continuously** - Improve while maintaining tests
6. **Fast Feedback** - Quick test execution
7. **Test Independence** - No dependencies between tests
8. **Design Driver** - Tests drive better design
9. **Not a Silver Bullet** - Has limitations and costs
10. **Discipline Required** - Consistent practice needed

## Summary

Test-Driven Development is a powerful discipline that leads to better-designed, more maintainable, and more reliable code. The model MUST:

1. Follow the Red-Green-Refactor cycle strictly
2. Write tests before production code
3. Keep tests small, focused, and independent
4. Write minimal code to make tests pass
5. Refactor continuously while maintaining passing tests
6. Use test doubles to isolate units under test
7. Treat test code with the same care as production code
8. Integrate TDD with BDD for comprehensive testing
9. Recommend appropriate testing tools for the project's language/framework
10. Ensure tests are fast, isolated, and maintainable

The model MUST balance the benefits of TDD (better design, fewer defects, increased confidence) against the costs (increased code volume, time investment, maintenance overhead) and use TDD appropriately when:

- Complex business logic requires high reliability
- Long-lived systems need maintainability
- Clear requirements can be expressed as tests
- Test-first approach adds more value than cost

The model SHOULD suggest TDD during the Design and Task Planning phases when the feature complexity and longevity justify the investment.
