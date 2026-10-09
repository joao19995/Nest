# AGENTS.md
## 1. Project Overview

Nest is a personal finance and monthly budget planning application for a household.

Its purpose is to replace a spreadsheet-based workflow with a simple, reliable, organized application that makes it easier to plan expenses, track actual spending, and calculate fair contributions between household members.

The goal is not to build a complex financial platform. Build only what provides clear, practical value.

### Product principles

- Keep the application simple and easy to use.
- Prefer clear, predictable behavior over clever solutions.
- Make financial calculations transparent and understandable.
- Keep the code organized and maintainable.
- Avoid unnecessary abstractions, dependencies, configuration, and indirection.
- Do not build features just because they might be useful in the future.

## 2. Core Development Philosophy

**Prefer the simplest maintainable solution that correctly solves the problem.**

Before implementing a change:

1. Understand the existing implementation and conventions.
2. Identify the actual problem and the smallest reasonable solution.
3. Reuse existing components, utilities, types, and patterns where appropriate.
4. Consider whether the change introduces unnecessary complexity.
5. Preserve existing behavior unless the task explicitly requires changing it.

Do not rewrite working code simply to introduce a preferred pattern or architecture.

Do not create generic frameworks, additional abstraction layers, factories, services, or configuration systems without a concrete need.

Avoid premature optimization and speculative future-proofing.

However, simplicity does not mean putting everything in one file. Keep responsibilities clearly separated where that improves readability and maintainability.

## 3. Architecture and Code Organization

Follow the existing project structure and architectural conventions.

- Keep business rules separate from UI components where practical.
- Keep database access within the existing repository/data-access patterns.
- Reuse shared types instead of duplicating domain definitions.
- Use TypeScript types to make domain assumptions explicit.
- Keep components focused and reasonably small.
- Avoid duplicating business logic across pages or components.
- Prefer explicit, readable code over overly generic implementations.

Do not introduce a new architectural pattern without first checking whether the existing approach is sufficient.

Do not move or rename files unnecessarily.

When modifying a feature, inspect its related domain logic, data access, UI, and tests before making changes.

## 4. Business Rules Are Critical

Nest handles real household finances. Financial calculations must be explicit, deterministic, and testable.

Never change a financial rule based on an assumption. If a requirement is ambiguous, identify the ambiguity and ask for clarification when it affects the result.

Important domain concepts include:

- Household members and their incomes.
- Income changes over time.
- Personal and joint accounts.
- Fixed and variable expense categories.
- Monthly budget templates.
- Monthly plans and actual expenses.
- Income-proportional household contributions.

### Income history

Income records have an effective date. For a given month, use the most recent income record whose effective date is on or before that month.

Do not assume the latest recorded income applies to every historical month.

### Monthly templates and plans

Templates define the expected expenses for a period.

When a monthly plan is created, it snapshots the applicable template. The plan must preserve its original planned values even if the template changes later.

Actual expenses can be edited while a month is open. A closed month is read-only.

Do not silently recalculate historical plans from current template data.

### Accounts

Personal accounts belong to an individual household member. The joint account does not belong to either individual.

When calculating personal spending for contribution settlement, count expenses paid from that person's personal account. Expenses paid from the joint account must not be attributed as personal spending to either member.

### Household contributions

Contributions are proportional to the applicable incomes of the household members.

The contribution base is:

`max(total planned expenses * 1.10, total actual expenses)`

The 10% margin is intentional.

Each person's contribution quota is their income proportion multiplied by the contribution base.

Personal expenses paid from an individual's account are credited against that person's quota:

- If the quota exceeds their personal spending, the difference is transferred to the joint account.
- If their personal spending exceeds their quota, the excess is reimbursed from the joint account.

Expenses paid from the joint account count toward total actual expenses, but not toward either person's personal spending.

The contribution calculation must not assume that existing money in the joint account can be consumed to cover a budget shortfall.

Preserve these rules unless the product owner explicitly changes them.

## 5. Database and Data Integrity

- Follow the existing database schema and migration conventions.
- Do not introduce schema changes when an application-level solution is sufficient.
- Never silently discard or reinterpret existing data.
- Keep data transformations explicit.
- Consider historical data and existing records when changing domain models.
- Do not introduce duplicated sources of truth.
- Treat the database as the source of truth for persisted application data.

If a schema or migration change is necessary, explain why and how it affects existing data.

## 6. UI and User Experience

The UI should be practical, consistent, and easy to understand.

- Reuse existing UI components and styling conventions.
- Show financial values and calculations clearly.
- Use consistent currency formatting.
- Make important differences, transfers, and totals understandable.
- Handle empty states, missing income, and invalid inputs explicitly.
- Avoid unnecessary screens, settings, dialogs, and interactions.

Do not add visual complexity without a clear usability benefit.

## 7. Testing and Validation

Add or update tests when changing business rules, calculations, data transformations, or other behavior where regressions would be costly.

Prefer focused tests that verify meaningful behavior and edge cases.

Before finishing:

1. Run the relevant tests.
2. Run the project's build or type-check command when appropriate.
3. Report any commands that could not be executed.
4. Never claim that tests or builds passed unless they were actually run.

Do not add tests that merely duplicate implementation details without validating useful behavior.

## 8. Working Process

For each task:

1. Inspect the relevant existing code before proposing changes.
2. Summarize the intended approach when the change is substantial.
3. Make the smallest complete change that solves the problem.
4. Check related code for regressions.
5. Run appropriate validation.
6. Summarize what changed, why, and any remaining concerns.

For small, clear tasks, proceed directly without unnecessary planning or excessive discussion.

Ask questions only when missing information materially affects correctness or scope.

Do not expand the scope of a task without a good reason.

Do not silently change unrelated files or behavior.

## 9. Definition of Done

A change is complete when:

- It solves the requested problem.
- It follows existing project conventions.
- It preserves unrelated behavior.
- Business rules remain correct.
- Relevant tests and validation have been run, or limitations are clearly reported.
- The implementation is understandable without unnecessary complexity.

## 10. Final Guiding Principle

Build Nest as a well-organized personal application, not as an enterprise platform.

Prefer boring, reliable, explicit solutions.

**Every abstraction, dependency, and extra layer must justify the complexity it introduces.**
