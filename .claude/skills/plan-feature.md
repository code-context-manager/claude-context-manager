---
name: plan-feature
description: Use when scoping or planning a new feature, before any code is written. Loads product vision and current project state.
trigger: User frames a not-yet-started piece of work — phrases like "let's plan", "new feature", "how should we approach", "what if we added".
---

# Planning a feature

## Context to load

1. [docs/vision.md](../../docs/vision.md) — the premise. A feature that doesn't close the context gap is suspect; flag it explicitly if it doesn't.
2. [docs/state/](../../docs/state/) — current state of the world. What's already built, what stage the project is in, who's working on it.

## While planning

- Propose **2–3 options with tradeoffs**, not a single recommendation handed down. The user's job is to choose.
- Identify **load-bearing sub-decisions** the feature requires. Examples: a new data source, a new UI pattern, a policy change ("we now write files"), a cross-cutting abstraction. Surface each one explicitly so the user can weigh in before code is written.
- Do **not write code** during planning. A plan that includes code has skipped a step.
- Keep the plan scoped to this feature. A plan that reshapes three unrelated areas is a refactor proposal, not a feature plan.

## Output shape

A good plan tells the user:

- The problem, framed in the user's terms
- The 2–3 options with tradeoffs
- A recommendation, with the reasoning
- The list of load-bearing sub-decisions the user needs to weigh in on
- Open questions that block starting implementation
