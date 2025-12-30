# AI Steering Files

This directory contains steering files that guide AI assistants in working with this project. These files define processes, standards, and methodologies to ensure consistent, high-quality development.

## Purpose

Steering files help AI systems understand:

- How to approach development tasks
- What standards and practices to follow
- How to collaborate effectively with you through structured processes

## Available Steering Files

- **[AI-ears-methodology.md](./AI-ears-methodology.md)** - Spec-driven development process with defined phases
- **[AI-bdd-methodology.md](./AI-bdd-methodology.md)** - Behavior-Driven Development using Gherkin scenarios (use when appropriate)
- **[AI-tdd-methodology.md](./AI-tdd-methodology.md)** - Test-Driven Development with Red-Green-Refactor cycle (use when appropriate)
- **[AI-coding-standards.md](./AI-coding-standards.md)** - Coding principles, quality standards, and tooling requirements

## How to Use

1. **Starting a new feature**: Reference `AI-ears-methodology.md` to guide the AI through the specification process
2. **During development**: Use `AI-coding-standards.md` to ensure code quality and consistency
3. **Specifications**: Feature specs are stored in `/specs/[feature-name]/` with phase documents

## Workflow

When starting work on a feature:

1. Provide initial requirements or user story
2. Work with AI through each EARS phase (Requirements → Design → Tasks → Test Plan → Implementation)
3. Approve each phase verbally before moving to the next
4. Use generated specs as context for implementation

## Compatibility

These steering files are designed to work with any AI system (GitHub Copilot, Codex, Claude, etc.) that can read markdown documentation.
