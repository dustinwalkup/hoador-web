# Coding Standards and Quality Guidelines

## Overview

This document defines coding principles, quality standards, and tooling requirements for the project. AI assistants should ensure these standards are met and propose appropriate tooling during the design phase.

## Core Principles

### DRY (Don't Repeat Yourself)

- Extract repeated logic into reusable functions/classes/modules
- Use configuration over duplication
- Consider when repetition is actually clearer than abstraction

### Clear and Intentional Code

- Write code that expresses intent
- Prefer readability over cleverness
- Use meaningful names for variables, functions, and classes
- Keep functions focused on a single responsibility

### Maintainability

- Write code that's easy to change
- Minimize coupling between components
- Document complex logic and business rules
- Leave code better than you found it

## Code Quality Tooling

### Required for Every Project

AI should ensure these are configured during the design/task planning phase:

1. **Linter**: Catch potential errors and enforce code style
2. **Formatter**: Automatic code formatting for consistency
3. **Type Checking**: Where applicable (TypeScript, Python type hints, etc.)
4. **Testing Framework**: Unit and integration testing capabilities
5. **Pre-commit Hooks**: Automated quality checks before commits

### Technology-Specific Recommendations

AI should propose appropriate tools based on the project's language/framework:

**JavaScript/TypeScript Projects:**

- ESLint (Airbnb style guide as baseline)
- Prettier
- TypeScript strict mode
- Jest or Vitest for testing

**Python Projects:**

- Black (formatter)
- Flake8 or Ruff (linter)
- mypy (type checking)
- pytest (testing)
- isort (import sorting)

**Other Languages:**

- Research and propose current best practices
- Prioritize widely-adopted, actively-maintained tools
- Explain rationale for tool choices

## Documentation Standards

### Code Comments

- **Do comment**: Why something is done, business rules, non-obvious implications
- **Don't comment**: What the code does (code should be self-documenting)
- **Always comment**: Complex algorithms, workarounds, TODOs with context

### README Files

Every project/major feature should have:

- Purpose and overview
- Setup/installation instructions
- Usage examples
- Testing instructions
- Contributing guidelines (if applicable)

### Inline Documentation

- Use docstrings/JSDoc for public APIs
- Document parameters, return types, and exceptions
- Include usage examples for complex functions

## Testing Standards

### Coverage

- Aim for meaningful coverage, not just percentage targets, that said, 80% is a good ideal
- Focus on critical user flows and business logic
- Test edge cases and error conditions

### Test Quality

- Tests should be readable and maintainable
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests independent and isolated

### Test Types

- **Unit tests**: Test individual functions/methods
- **Integration tests**: Test component interactions
- **E2E tests**: Test critical user flows (where applicable)

## Version Control Practices

### Commits

- Make atomic, focused commits
- Write clear commit messages
- Reference issue/spec numbers when applicable

### Branches

- Follow project's branching strategy, use /feature, /bugfix, /hotfix where appropriate
- Never use a development branch or branches for lower environments - only feature branching
- Use descriptive branch names
- Keep branches focused and short-lived

## Architecture Principles

### Separation of Concerns

- Separate business logic from UI
- Isolate external dependencies
- Use layers/modules appropriately

### Configuration Management

- Externalize configuration
- Never commit secrets or credentials
- Use environment variables for deployment-specific settings

### Error Handling

- Handle errors explicitly
- Provide meaningful error messages
- Log errors appropriately
- Fail fast when appropriate

### Security Considerations

- Validate all inputs
- Sanitize outputs
- Follow principle of least privilege
- Keep dependencies updated
- Review security implications during design phase

## AI Responsibilities

When working on this project, AI should:

1. **During Design Phase**: Propose appropriate linters, formatters, and testing tools
2. **During Task Planning**: Include setup tasks for quality tools
3. **During Implementation**: Follow established standards and patterns
4. **Code Review**: Point out violations of these principles
5. **Tool Recommendations**: Suggest updates to tooling as better options emerge
6. **Context Awareness**: Adapt recommendations to project's existing patterns

## Flexibility

These are guidelines, not rigid rules:

- Standards can evolve as the project grows
- Suggest improvements to these standards when appropriate
- Context matters - explain when and why to deviate
- Consistency within the project is more important than external standards

## Quality Checklist

Before considering code complete, verify:

- [ ] Linter passes with no errors
- [ ] Formatter applied
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No hardcoded secrets or credentials
- [ ] Error cases handled
- [ ] Code reviewed against requirements
- [ ] Performance considerations addressed (if applicable)
