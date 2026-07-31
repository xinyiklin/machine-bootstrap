# Delivery Plan — <task title>

Owner: Delivery Lead · Workflow: `product-delivery` 1.0.0

| Field | Value |
| :--- | :--- |
| Task id | `<task-id>` |
| Version | v1 |
| Status | draft / awaiting approval / approved / superseded |
| Date | `<YYYY-MM-DD>` |
| Implements Product Brief | `<task-id>` v1 (approved `<YYYY-MM-DD>`) |
| Supersedes | — |

> Approving this exact version means: *this version and its technical approach,
> phases, tradeoffs, risk treatment, and verification strategy are approved for
> execution.* It authorizes implementation within this scope only.

## Repository State Inspected

| Field | Value |
| :--- | :--- |
| Repository | `<path or remote>` |
| Branch | `<branch>` |
| Commit | `<full sha>` |

## Current-State Findings

What the code actually does today in the affected area: entry points, callers,
state owners, side effects, existing tests and what they really cover, and
behavior that must be preserved. Cite files and lines.

- …

## Proposed Technical Design

The approach, and the reasoning that makes it the right one here. Name the
alternative you rejected and why.

## Acceptance-Criteria Mapping

Every criterion from the approved brief maps to implementation and
verification. No criterion may be blank.

| # | Acceptance criterion | Implementation | Verification |
| :--- | :--- | :--- | :--- |
| 1 | … | … | … |
| 2 | … | … | … |

## Affected Components And Data Flows

Which modules, layers, and flows change, and how data moves through them after
the change.

- …

## Schema, Serialization, API, Persistence, Migration

Format or contract changes, version bumps, migration steps, and what happens to
existing data. Write "none" when there are none — do not delete the heading if
the change touches persistence at all.

- …

## UI And Interaction Changes

Screens, states, controls, and transitions that change. Delete if not
applicable.

- …

## Compatibility Behavior

What happens with older data, older clients, existing configuration, and
in-flight state.

- …

## Implementation Phases

Ordered, each independently reviewable, each with a completion signal.

1. **<phase>** — scope, and how you know it is done.
2. …

## Proposed Specialist Assignments

Bounded assignments only, each with an owner, a file scope, and the evidence it
must return. Write "none; implemented directly" when delegation would cost more
than it saves.

| Assignment | Scope / files owned | Required evidence |
| :--- | :--- | :--- |
| … | … | … |

## Testing And Verification

The project's actual commands, plus what each one demonstrates. State whether
independent verification is required and why.

- …

## Risks

Regression, privacy, security, and data-loss risks, each with how the plan
treats it.

| Risk | Kind | Treatment |
| :--- | :--- | :--- |
| … | regression / privacy / security / data loss | … |

## Rollout And Rollback

How the change lands and how it is reversed if it is wrong. Write "not
applicable; local change" when true.

## Decisions Requiring The User

Choices this plan cannot make alone. An empty list is a meaningful statement.

- …

## Explicitly Deferred

Work intentionally left out of this plan, so it is not mistaken for an
oversight.

- …
